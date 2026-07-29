import { intentLabel, urgencyLabel } from "@/lib/booking";

export type LeadGrade = {
  heat: "high" | "mid" | "low";
  suggestion: string;
  summary: string;
  nextAction: string;
};

const AREA_KEYWORDS = [
  "北屯",
  "西屯",
  "南屯",
  "太平",
  "大里",
  "潭子",
  "豐原",
  "沙鹿",
  "台中",
  "台北",
  "新北",
  "桃園",
  "新竹",
  "台南",
  "高雄"
];

export function gradeLead(intent: string[], urgency: string | null, note: string): LeadGrade {
  let score = 0;
  if (intent.includes("buy")) score += 3;
  if (intent.includes("sell")) score += 3;
  if (intent.includes("rent")) score += 1;
  if (intent.includes("legal")) score += 1;
  if (urgency === "asap") score += 2;
  if (urgency === "soon") score += 1;
  if (/急|盡快|這個月|現金|週轉|出售|想賣|換屋/.test(note)) score += 1;

  const heat: LeadGrade["heat"] = score >= 4 ? "high" : score >= 2 ? "mid" : "low";
  const area = AREA_KEYWORDS.find((keyword) => note.includes(keyword));
  const intentText = intent.length ? intent.map(intentLabel).join("、") : "一般諮詢";
  const urgencyText = urgencyLabel(urgency);

  return {
    heat,
    suggestion:
      heat === "high"
        ? `${intentText}且時程明確，建議優先聯絡並準備行情。`
        : heat === "mid"
          ? `${intentText}需求已成形，先補齊預算、區域與決策時間。`
          : `${intentText}仍在前期，先提供精簡資訊並設定追蹤日。`,
    summary: `${area ? `${area}，` : ""}${intentText}，${urgencyText}。${note.slice(0, 90)}`,
    nextAction:
      heat === "high"
        ? "24 小時內聯絡，先確認底線、時間壓力與決策者。"
        : heat === "mid"
          ? "預約前整理三個選項，通話時確認優先順序。"
          : "提供一頁式資料，七天後安排一次簡短追蹤。"
  };
}
