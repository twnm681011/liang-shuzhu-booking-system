import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const DATA_DIR = path.join(process.cwd(), "data");
const DATABASE_FILE = path.join(DATA_DIR, "appointments.json");
const SEED_FILE = path.join(DATA_DIR, "appointments.seed.json");

export type AppointmentStatus = "confirmed" | "completed" | "cancelled";

export type Appointment = {
  id: string;
  name: string;
  phone: string;
  email: string;
  meetType: string;
  intent: string[];
  urgency: string | null;
  note: string;
  slotIso: string;
  status: AppointmentStatus;
  aiHeat: "high" | "mid" | "low";
  aiSuggestion: string;
  aiSummary: string;
  aiNextAction: string;
  previewFile: string | null;
  createdAt: string;
};

export class SlotConflictError extends Error {
  constructor() {
    super("這個時段剛剛被預約，請重新選擇。");
    this.name = "SlotConflictError";
  }
}

// ---------- 正式資料庫模式（有設定 DATABASE_URL 時啟用） ----------

const DATABASE_URL = process.env.DATABASE_URL;
const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

let tableReady: Promise<void> | null = null;

function ensureTable() {
  if (!pool) return Promise.resolve();
  if (!tableReady) {
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS appointments_store (
           id INT PRIMARY KEY DEFAULT 1,
           rows JSONB NOT NULL DEFAULT '[]'::jsonb
         )`
      )
      .then(() =>
        pool.query(
          `INSERT INTO appointments_store (id, rows) VALUES (1, '[]'::jsonb) ON CONFLICT (id) DO NOTHING`
        )
      )
      .then(() => undefined);
  }
  return tableReady;
}

// ---------- 本機檔案模式（沒有設定 DATABASE_URL 時，教學/開發用） ----------

let writeQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(operation: () => Promise<T>) {
  const run = writeQueue.then(operation, operation);
  writeQueue = run.catch(() => undefined);
  return run;
}

async function readJsonFile(file: string): Promise<Appointment[]> {
  const raw = await fs.readFile(file, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as Appointment[]) : [];
}

async function readAppointmentsFromFile(): Promise<Appointment[]> {
  try {
    return await readJsonFile(DATABASE_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return readJsonFile(SEED_FILE);
  }
}

async function writeAppointmentsToFile(rows: Appointment[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const temporary = `${DATABASE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  await fs.rename(temporary, DATABASE_FILE);
}

// ---------- 對外統一介面（自動依有無 DATABASE_URL 切換模式） ----------

export async function readAppointments(): Promise<Appointment[]> {
  if (pool) {
    await ensureTable();
    const result = await pool.query<{ rows: Appointment[] }>(
      `SELECT rows FROM appointments_store WHERE id = 1`
    );
    return result.rows[0]?.rows ?? [];
  }
  return readAppointmentsFromFile();
}

async function writeAppointments(rows: Appointment[]) {
  if (pool) {
    await ensureTable();
    await pool.query(`UPDATE appointments_store SET rows = $1::jsonb WHERE id = 1`, [
      JSON.stringify(rows)
    ]);
    return;
  }
  await writeAppointmentsToFile(rows);
}

export async function bookedSlots() {
  const rows = await readAppointments();
  return new Set(rows.filter((row) => row.status === "confirmed").map((row) => row.slotIso));
}

export async function listAppointments(status = "all") {
  const rows = await readAppointments();
  const filtered = status === "all" ? rows : rows.filter((row) => row.status === status);
  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

type CreateAppointmentInput = Omit<Appointment, "id" | "status" | "previewFile" | "createdAt">;

export async function createAppointment(input: CreateAppointmentInput) {
  if (pool) {
    await ensureTable();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ rows: Appointment[] }>(
        `SELECT rows FROM appointments_store WHERE id = 1 FOR UPDATE`
      );
      const rows = result.rows[0]?.rows ?? [];
      if (rows.some((row) => row.status === "confirmed" && row.slotIso === input.slotIso)) {
        await client.query("ROLLBACK");
        throw new SlotConflictError();
      }
      const appointment: Appointment = {
        ...input,
        id: crypto.randomUUID(),
        status: "confirmed",
        previewFile: null,
        createdAt: new Date().toISOString()
      };
      rows.push(appointment);
      await client.query(`UPDATE appointments_store SET rows = $1::jsonb WHERE id = 1`, [
        JSON.stringify(rows)
      ]);
      await client.query("COMMIT");
      return appointment;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  return withLock(async () => {
    const rows = await readAppointmentsFromFile();
    if (rows.some((row) => row.status === "confirmed" && row.slotIso === input.slotIso)) {
      throw new SlotConflictError();
    }
    const appointment: Appointment = {
      ...input,
      id: crypto.randomUUID(),
      status: "confirmed",
      previewFile: null,
      createdAt: new Date().toISOString()
    };
    rows.push(appointment);
    await writeAppointmentsToFile(rows);
    return appointment;
  });
}

export async function attachPreview(id: string, previewFile: string) {
  const apply = async () => {
    const rows = pool ? await readAppointments() : await readAppointmentsFromFile();
    const appointment = rows.find((row) => row.id === id);
    if (!appointment) return;
    appointment.previewFile = previewFile;
    if (pool) {
      await writeAppointments(rows);
    } else {
      await writeAppointmentsToFile(rows);
    }
  };
  return pool ? apply() : withLock(apply);
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const apply = async () => {
    const rows = pool ? await readAppointments() : await readAppointmentsFromFile();
    const appointment = rows.find((row) => row.id === id);
    if (!appointment) return null;
    appointment.status = status;
    if (pool) {
      await writeAppointments(rows);
    } else {
      await writeAppointmentsToFile(rows);
    }
    return appointment;
  };
  return pool ? apply() : withLock(apply);
}
