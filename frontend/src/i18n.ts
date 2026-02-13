import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  zh: {
    translation: {
      app_title: "墨 陣",
      upload: "入 庫",
      explorer: "識 覽",
      full_text: "全 文",
      precision: "萃 精",
      export: "拓 印",
      identify: "識 碑",
      grid: "建 陣",
      align: "對 位",
      inspect: "萃 精",
      confirm: "確 認 建 陣",
      discard: "放 棄",
      reset: "重 置",
      add_v: "增 設 縱 線",
      add_h: "增 設 橫 線",
      stele_name: "碑 帖 標 題",
      offset: "位 序 偏 移",
      ai_match: "智 能 匹 配",
      return_workbench: "返 回 研 學 台",
      grid_master: "建 陣 核 心",
      pro_controls: "高 階 操 控",
      shift_drag: "按住 Shift 鍵移動群组",
      hover_label: "懸停標籤可刪除多餘線條"
    }
  },
  en: {
    translation: {
      app_title: "InkGrid",
      upload: "INGEST",
      explorer: "EXPLORER",
      full_text: "FULL TEXT",
      precision: "INSPECT",
      export: "EXPORT",
      identify: "ID",
      grid: "GRID",
      align: "ALIGN",
      inspect: "INSPECT",
      confirm: "DEPLOY MATRIX",
      discard: "DISCARD",
      reset: "RESET",
      add_v: "ADD VERTICAL",
      add_h: "ADD HORIZONTAL",
      stele_name: "STELE NAME",
      offset: "INDEX OFFSET",
      ai_match: "AI MATCH",
      return_workbench: "WORKBENCH",
      grid_master: "GRID MASTER",
      pro_controls: "PRO CONTROLS",
      shift_drag: "Hold Shift for Group Move",
      hover_label: "Hover label to delete"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
