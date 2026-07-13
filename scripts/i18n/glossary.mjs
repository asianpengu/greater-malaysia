export const GLOSSARY = {
  // Primary nav
  navTools: { en: "Tools", ms: "Alatan", zh: "工具" },
  navAnswers: { en: "Answers", ms: "Jawapan", zh: "答案" },
  navElection: { en: "Election", ms: "Pilihan Raya", zh: "选举" },
  navExplainers: { en: "Explainers", ms: "Penjelasan", zh: "解读" },
  navStories: { en: "Data stories", ms: "Cerita Data", zh: "数据故事" },
  navFollow: { en: "Follow the channel", ms: "Ikuti saluran", zh: "关注频道" },

  // Footer brand
  footTag: {
    en: "Malaysia, in real time. Free live tools built on the nation's open data.",
    ms: "Malaysia, secara masa nyata. Alatan langsung percuma dibina atas data terbuka negara.",
    zh: "实时马来西亚。基于国家开放数据打造的免费实时工具。",
  },

  // Footer column headers
  footColTools: { en: "Tools", ms: "Alatan", zh: "工具" },
  footColAnswersElection: { en: "Answers + Election", ms: "Jawapan + Pilihan Raya", zh: "答案与选举" },
  footColRead: { en: "Read", ms: "Bacaan", zh: "阅读" },
  footColTrust: { en: "Trust + machines", ms: "Kepercayaan + mesin", zh: "信任与机器" },

  // Footer "Tools" column links
  footWaktuSolat: { en: "Waktu solat", ms: "Waktu solat", zh: "祈祷时间" },
  footHargaMinyak: { en: "Harga minyak", ms: "Harga minyak", zh: "油价" },
  footRinggit: { en: "Ringgit", ms: "Ringgit", zh: "令吉汇率" },
  footIncomeByState: { en: "Income by state", ms: "Pendapatan ikut negeri", zh: "各州收入" },
  footTakeHomePay: { en: "Take-home pay", ms: "Gaji bersih", zh: "实拿薪水" },
  footRoadTax: { en: "Road tax", ms: "Cukai jalan", zh: "路税" },
  footStampDuty: { en: "Stamp duty", ms: "Duti setem", zh: "印花税" },
  footCutiPlanner: { en: "Cuti planner", ms: "Perancang cuti", zh: "假期规划" },
  footMalaysiaToday: { en: "Malaysia today", ms: "Malaysia hari ini", zh: "今日马来西亚" },

  // Footer "Answers + Election" column links
  footQuickAnswers: { en: "Quick answers", ms: "Jawapan pantas", zh: "快速答案" },
  footGe16Hub: { en: "GE16 hub", ms: "Pusat PRU16", zh: "第16届大选专区" },
  footWhenIsGe16: { en: "When is GE16", ms: "Bila PRU16", zh: "第16届大选何时举行" },
  footCheckVoterReg: { en: "Check voter reg", ms: "Semak daftar pengundi", zh: "查询选民登记" },

  // Footer "Read" column links
  footDataStories: { en: "Data stories", ms: "Cerita Data", zh: "数据故事" },
  footExplainersLink: { en: "Explainers", ms: "Penjelasan", zh: "解读" },
  footDigitalNomads: { en: "Digital nomads", ms: "Nomad digital", zh: "数字游民" },
  footStartBusiness: { en: "Start a business", ms: "Mulakan perniagaan", zh: "创业指南" },

  // Footer "Trust + machines" column links
  footForAgents: { en: "For agents", ms: "Untuk ejen AI", zh: "面向AI代理" },
  footSourcePolicy: { en: "Source policy", ms: "Dasar sumber", zh: "来源政策" },
  footDataFeed: { en: "Data feed", ms: "Suapan data", zh: "数据源" },
  footSitemap: { en: "Sitemap", ms: "Peta laman", zh: "网站地图" },

  // Footer bottom
  footDisclaimer: {
    en: "Independent and non-partisan. Every number links to its official primary source.",
    ms: "Bebas dan tidak berpihak. Setiap angka dipautkan ke sumber rasmi asal.",
    zh: "独立且不偏不倚。每个数字都链接到官方原始来源。",
  },
  // NOT a full `>text<` text node — only present on some pages, and the
  // markup splits it as `>Follow the channel: <a href="...">WhatsApp</a> ·
  // <a href="...">Telegram</a>`. applyNavFooterGlossary special-cases this
  // one key: it matches the `>en<a` prefix-before-link form instead of the
  // generic `>en<` whole-node form every other key uses.
  footFollowPrefix: { en: "Follow the channel: ", ms: "Ikuti saluran: ", zh: "关注频道:" },
  footBuiltBy: { en: "Built by", ms: "Dibina oleh", zh: "开发者" },
};
