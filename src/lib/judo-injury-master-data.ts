import { JudoInjuryCategory, LateralityRule } from "@prisma/client";

export type JudoInjuryMasterSeed = {
  category: JudoInjuryCategory;
  partLabel: string;
  sortOrder: number;
  lateralityRule: LateralityRule;
};

export const JUDO_INJURY_MASTER: JudoInjuryMasterSeed[] = [
  // 骨折（頭部なし → 上肢 → 体幹 → 下肢）
  {
    category: "FRACTURE",
    partLabel: "鎖骨",
    sortOrder: 1,
    lateralityRule: "REQUIRED",
  },
  {
    category: "FRACTURE",
    partLabel: "上腕骨",
    sortOrder: 2,
    lateralityRule: "REQUIRED",
  },
  {
    category: "FRACTURE",
    partLabel: "前腕骨",
    sortOrder: 3,
    lateralityRule: "REQUIRED",
  },
  {
    category: "FRACTURE",
    partLabel: "手根骨",
    sortOrder: 4,
    lateralityRule: "REQUIRED",
  },
  {
    category: "FRACTURE",
    partLabel: "中手骨",
    sortOrder: 5,
    lateralityRule: "REQUIRED",
  },
  {
    category: "FRACTURE",
    partLabel: "肋骨",
    sortOrder: 6,
    lateralityRule: "REQUIRED",
  },
  {
    category: "FRACTURE",
    partLabel: "大腿骨",
    sortOrder: 7,
    lateralityRule: "REQUIRED",
  },
  {
    category: "FRACTURE",
    partLabel: "下腿骨",
    sortOrder: 8,
    lateralityRule: "REQUIRED",
  },
  {
    category: "FRACTURE",
    partLabel: "足根骨",
    sortOrder: 9,
    lateralityRule: "REQUIRED",
  },
  {
    category: "FRACTURE",
    partLabel: "中足骨",
    sortOrder: 10,
    lateralityRule: "REQUIRED",
  },
  {
    category: "FRACTURE",
    partLabel: "指（手・足）骨",
    sortOrder: 11,
    lateralityRule: "REQUIRED",
  },

  // 不全骨折（頭部なし → 上肢 → 体幹 → 下肢）
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "鎖骨",
    sortOrder: 1,
    lateralityRule: "REQUIRED",
  },
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "上腕骨",
    sortOrder: 2,
    lateralityRule: "REQUIRED",
  },
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "前腕骨",
    sortOrder: 3,
    lateralityRule: "REQUIRED",
  },
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "手根骨",
    sortOrder: 4,
    lateralityRule: "REQUIRED",
  },
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "中手骨",
    sortOrder: 5,
    lateralityRule: "REQUIRED",
  },
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "胸骨",
    sortOrder: 6,
    lateralityRule: "REQUIRED",
  },
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "肋骨",
    sortOrder: 7,
    lateralityRule: "REQUIRED",
  },
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "骨盤",
    sortOrder: 8,
    lateralityRule: "REQUIRED",
  },
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "大腿骨",
    sortOrder: 9,
    lateralityRule: "REQUIRED",
  },
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "下腿骨",
    sortOrder: 10,
    lateralityRule: "REQUIRED",
  },
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "膝蓋骨",
    sortOrder: 11,
    lateralityRule: "REQUIRED",
  },
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "足根骨",
    sortOrder: 12,
    lateralityRule: "REQUIRED",
  },
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "中足骨",
    sortOrder: 13,
    lateralityRule: "REQUIRED",
  },
  {
    category: "INCOMPLETE_FRACTURE",
    partLabel: "指（手・足）骨",
    sortOrder: 14,
    lateralityRule: "REQUIRED",
  },

  // 脱臼（頭部 → 上肢 → 下肢）
  {
    category: "DISLOCATION",
    partLabel: "顎関節",
    sortOrder: 1,
    lateralityRule: "REQUIRED",
  },
  {
    category: "DISLOCATION",
    partLabel: "肩関節",
    sortOrder: 2,
    lateralityRule: "REQUIRED",
  },
  {
    category: "DISLOCATION",
    partLabel: "肘関節",
    sortOrder: 3,
    lateralityRule: "REQUIRED",
  },
  {
    category: "DISLOCATION",
    partLabel: "手関節",
    sortOrder: 4,
    lateralityRule: "REQUIRED",
  },
  {
    category: "DISLOCATION",
    partLabel: "指（手・足）関節",
    sortOrder: 5,
    lateralityRule: "REQUIRED",
  },
  {
    category: "DISLOCATION",
    partLabel: "股関節",
    sortOrder: 6,
    lateralityRule: "REQUIRED",
  },
  {
    category: "DISLOCATION",
    partLabel: "膝関節",
    sortOrder: 7,
    lateralityRule: "REQUIRED",
  },
  {
    category: "DISLOCATION",
    partLabel: "足関節",
    sortOrder: 8,
    lateralityRule: "REQUIRED",
  },

  // 打撲（頭部 → 上肢 → 体幹 → 下肢）
  {
    category: "CONTUSION",
    partLabel: "頭部",
    sortOrder: 1,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "顔面部",
    sortOrder: 2,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "頸部",
    sortOrder: 3,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "上腕部",
    sortOrder: 4,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "肘部",
    sortOrder: 5,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "前腕部",
    sortOrder: 6,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "手根部",
    sortOrder: 7,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "中手部",
    sortOrder: 8,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "指部",
    sortOrder: 9,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "胸部",
    sortOrder: 10,
    lateralityRule: "NONE",
  },
  {
    category: "CONTUSION",
    partLabel: "背部",
    sortOrder: 11,
    lateralityRule: "NONE",
  },
  {
    category: "CONTUSION",
    partLabel: "腰殿部",
    sortOrder: 12,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "大腿部",
    sortOrder: 13,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "膝部",
    sortOrder: 14,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "下腿部",
    sortOrder: 15,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "足根部",
    sortOrder: 16,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "中足部",
    sortOrder: 17,
    lateralityRule: "REQUIRED",
  },
  {
    category: "CONTUSION",
    partLabel: "趾部",
    sortOrder: 18,
    lateralityRule: "REQUIRED",
  },

  // 捻挫（頭部 → 上肢 → 体幹 → 下肢）
  {
    category: "SPRAIN",
    partLabel: "頸部",
    sortOrder: 1,
    lateralityRule: "NONE",
  },
  {
    category: "SPRAIN",
    partLabel: "肩関節",
    sortOrder: 2,
    lateralityRule: "REQUIRED",
  },
  {
    category: "SPRAIN",
    partLabel: "肘関節",
    sortOrder: 3,
    lateralityRule: "REQUIRED",
  },
  {
    category: "SPRAIN",
    partLabel: "手関節",
    sortOrder: 4,
    lateralityRule: "REQUIRED",
  },
  {
    category: "SPRAIN",
    partLabel: "中手指関節",
    sortOrder: 5,
    lateralityRule: "REQUIRED",
  },
  {
    category: "SPRAIN",
    partLabel: "指関節",
    sortOrder: 6,
    lateralityRule: "REQUIRED",
  },
  {
    category: "SPRAIN",
    partLabel: "腰部",
    sortOrder: 7,
    lateralityRule: "NONE",
  },
  {
    category: "SPRAIN",
    partLabel: "股関節",
    sortOrder: 8,
    lateralityRule: "REQUIRED",
  },
  {
    category: "SPRAIN",
    partLabel: "膝関節",
    sortOrder: 9,
    lateralityRule: "REQUIRED",
  },
  {
    category: "SPRAIN",
    partLabel: "足関節",
    sortOrder: 10,
    lateralityRule: "REQUIRED",
  },
  {
    category: "SPRAIN",
    partLabel: "中足趾関節",
    sortOrder: 11,
    lateralityRule: "REQUIRED",
  },
  {
    category: "SPRAIN",
    partLabel: "趾関節",
    sortOrder: 12,
    lateralityRule: "REQUIRED",
  },

  // 挫傷（頭部なし → 上肢 → 体幹 → 下肢）
  {
    category: "STRAIN",
    partLabel: "上腕部",
    sortOrder: 1,
    lateralityRule: "REQUIRED",
  },
  {
    category: "STRAIN",
    partLabel: "前腕部",
    sortOrder: 2,
    lateralityRule: "REQUIRED",
  },
  {
    category: "STRAIN",
    partLabel: "胸部",
    sortOrder: 3,
    lateralityRule: "NONE",
  },
  {
    category: "STRAIN",
    partLabel: "背部",
    sortOrder: 4,
    lateralityRule: "NONE",
  },
  {
    category: "STRAIN",
    partLabel: "大腿部",
    sortOrder: 5,
    lateralityRule: "REQUIRED",
  },
  {
    category: "STRAIN",
    partLabel: "下腿部",
    sortOrder: 6,
    lateralityRule: "REQUIRED",
  },
];
