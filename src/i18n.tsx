import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Reason } from './engine/types';

export type Lang = 'ar' | 'en';

type Dict = Record<string, string>;

const ar: Dict = {
  appName: 'FPL Edge',
  tagline: 'ميزتك على دوريك المصغّر',
  'tab.home': 'الرئيسية', 'tab.captain': 'الكابتن', 'tab.transfers': 'الانتقالات', 'tab.league': 'الدوري', 'tab.more': 'المزيد',
  loading: 'نجهّز الملعب…', loadingSim: 'نحاكي الجولة 10,000 مرة…', loadError: 'تعذّر تحميل البيانات', loadErrorHint: 'تأكد من اتصالك بالإنترنت ثم أعد المحاولة.', retry: 'إعادة المحاولة',
  offline: 'أنت غير متصل — نعرض آخر بيانات محفوظة',
  updated: 'آخر تحديث', gw: 'الجولة', gwShort: 'ج', deadline: 'الموعد النهائي', deadlinePassed: 'انتهى الموعد',
  days: 'يوم', hours: 'ساعة', minutes: 'دقيقة', seconds: 'ثانية',
  demoTitle: 'أهلاً بك في FPL Edge',
  demoSlim: 'هذا مثال — اضغط هنا وأدخل رقم فريقك', demoShort: 'اكتب رقم فريقك لترى تحليلك. المعروض الآن مثال: فريق ',
  points: 'نقطة', pts: 'نقاط', xPts: 'النقاط المتوقعة', xp: 'متوقع',
  median: 'الوسيط', range: 'المدى ١٠–٩٠٪', p10: 'أسوأ ١٠٪', p90: 'أفضل ١٠٪',
  pGoal: 'يسجّل', pAssist: 'يصنع', pCS: 'شباك نظيفة', p10plus: '+10 نقاط', pBlank: 'يخفق (≤2)',
  // home
  'home.captain': 'الكابتن المقترح', 'home.transfer': 'أفضل انتقال', 'home.winProb': 'احتمال الفوز بالدوري',
  'home.chaos': 'مؤشر الفوضى', 'home.squad': 'توقع فريقك هذه الجولة', 'home.report': 'تقرير الجولة الماضية',
  'home.noTransfer': 'لا يوجد انتقال يستحق — احتفظ بانتقالك', 'home.seeAll': 'عرض الكل', 'home.leagueRank': 'ترتيبك في الدوري',
  'home.deadlineMode': 'وضع الموعد النهائي', 'home.story': 'بطاقة ستوري',
  // captain
  'cap.title': 'اختيار الكابتن', 'cap.sub': 'كم نقطة قد يجلب لك كل خيار؟ محسوبة من 10,000 محاكاة للجولة، ونقاط الكابتن مضاعفة.',
  'cap.safe': 'آمن', 'cap.upside': 'مغامرة', 'cap.mean': 'نقاط متوقعة', 'cap.leagueEo': 'امتلاك خصومك', 'cap.topEo': 'كابتن عند أفضل 10 آلاف',
  'cap.safeHint': 'الآمن يفضّل الأرضية العالية (أسوأ ١٠٪ والوسيط)، والمغامرة تفضّل السقف (أفضل ١٠٪ واحتمال +10).',
  'cap.pick': 'اختيار Edge',
  // transfers
  'tr.title': 'مخطط الانتقالات', 'tr.sub': 'خطّط لست جولات: اسحب لاعباً من القائمة وأفلته على لاعب في التشكيلة، أو المس لاعباً ثم بديله.',
  'tr.bank': 'الرصيد', 'tr.ft': 'انتقالات مجانية', 'tr.hits': 'خصم', 'tr.projected': 'المتوقع', 'tr.vsBaseline': 'مقارنة بلا انتقالات',
  'tr.optimizer': 'المُحسِّن', 'tr.optSub': 'أفضل 1 أو 2 أو 3 انتقالات حسب رصيدك وانتقالاتك المجانية.', 'tr.horizon': 'المدى',
  'tr.moves': 'انتقالات', 'tr.gain': 'المكسب', 'tr.net': 'الصافي', 'tr.add': 'أضف للخطة', 'tr.clear': 'مسح الخطة',
  'tr.hitValue': 'القيمة الحقيقية لخصم −4', 'tr.hitWorth': 'الانتقال الإضافي يضيف {gain} نقطة مقابل خصم 4 — {verdict}',
  'tr.worth': 'يستحق', 'tr.notWorth': 'لا يستحق', 'tr.search': 'ابحث عن لاعب…', 'tr.selectOut': 'اختر لاعباً لبيعه', 'tr.selected': 'سيُباع: {name} — اختر البديل',
  'tr.problem.budget': 'الرصيد لا يكفي', 'tr.problem.teamLimit': 'أكثر من 3 لاعبين من فريق واحد', 'tr.problem.position': 'مركز مختلف',
  'tr.dragHint': 'اسحب الانتقال بين الجولات لتغيير توقيته', 'tr.noSquad': 'لا تتوفر تشكيلة بعد.', 'tr.all': 'الكل',
  'tr.chip': 'شريحة', 'tr.none': 'بدون', 'tr.sell': 'سعر البيع', 'tr.undo': 'تراجع',
  // league
  'lg.title': 'الدوري المصغّر', 'lg.standings': 'الترتيب', 'lg.dial': 'المخاطرة', 'lg.rivals': 'الخصوم', 'lg.eo': 'ماذا لو',
  'lg.dialTitle': 'مؤشر المخاطرة', 'lg.rivalsTitle': 'حمض الخصوم',
  'lg.pWin': 'يفوز باللقب', 'lg.pLead': 'يتصدر بعد الجولة', 'lg.expRank': 'الترتيب المتوقع', 'lg.total': 'المجموع', 'lg.gap': 'الفارق',
  'lg.you': 'أنت', 'lg.demoNote': 'هذا مثال: أفضل 20 مديراً في العالم كأنهم دوري مصغّر. اكتب رقم فريقك لترى دوريك الحقيقي.',
  'lg.mode.protect': 'حماية', 'lg.mode.balanced': 'توازن', 'lg.mode.attack': 'هجوم',
  'lg.modeExplain.protect': 'أنت في الصدارة: غطِّ لاعبي خصومك (الملكية الفعلية) وقلّل التباين.',
  'lg.modeExplain.balanced': 'المنافسة متقاربة: اتبع أعلى النقاط المتوقعة.',
  'lg.modeExplain.attack': 'أنت تطارد: ارفع التباين واختر لاعبين مختلفين عن خصومك.',
  'lg.dialSub': 'نحسّن احتمال فوزك بالدوري، لا مجرد النقاط. حرّك المؤشر لترى كيف تتغير التوصيات.',
  'lg.moveImpact': 'أثر كل انتقال على احتمال فوزك', 'lg.before': 'الآن', 'lg.after': 'بعده',
  'lg.whatIf': 'ماذا لو؟', 'lg.whatIfSub': 'اختر لاعباً لترى أين ستكون بعد الجولة إن أخفق أو تألق.',
  'lg.ifBlank': 'إن أخفق {name} ستكون في المركز {rank}', 'lg.ifHaul': 'إن تألق {name} ستكون في المركز {rank}',
  'lg.eoTable': 'الملكية الفعلية بين خصومك', 'lg.own': 'تملكه', 'lg.notOwn': 'لا تملكه',
  'lg.captaincy': 'أسلوب الكابتن', 'lg.style.template': 'تقليدي', 'lg.style.balanced': 'متوازن', 'lg.style.contrarian': 'معاكس',
  'lg.hits': 'الخصومات', 'lg.chaser': 'يطارد المتألقين', 'lg.notChaser': 'لا يطارد', 'lg.bank': 'متوسط الرصيد', 'lg.chipsLeft': 'شرائح متبقية',
  'lg.predCaptain': 'الكابتن المتوقع', 'lg.predIn': 'قد يشتري', 'lg.predOut': 'قد يبيع', 'lg.beat': 'احتمال تجاوزه', 'lg.howToBeat': 'كيف تتفوق عليه',
  'lg.perGw': 'انتقال/جولة', 'lg.avgPts': 'معدل النقاط', 'lg.capHit': 'نجاح الكابتن', 'lg.bench': 'نقاط الدكة/جولة',
  // more
  'more.title': 'المزيد', 'more.prices': 'رادار الأسعار', 'more.pricesSub': 'من سيرتفع ومن سينخفض الليلة',
  'more.diffs': 'اللاعبون المختلفون', 'more.diffsSub': 'نقاط عالية بملكية منخفضة', 'more.fixtures': 'جدول المباريات', 'more.fixturesSub': 'صعوبة 8 جولات قادمة',
  'more.chips': 'مخطط الشرائح', 'more.chipsSub': 'أفضل جولة لكل شريحة', 'more.dream': 'الفريق الحلم', 'more.dreamSub': 'أفضل 15 بميزانيتك',
  'more.injuries': 'الإصابات والتشكيلة', 'more.injuriesSub': 'الأخبار واحتمال البداية', 'more.report': 'تقرير الجولة', 'more.reportSub': 'ما نجح وما أخفق',
  'more.hindsight': 'محرك الأثر الرجعي', 'more.hindsightSub': 'لو اتبعت FPL Edge طوال الموسم', 'more.journal': 'سجل القرارات', 'more.journalSub': 'المهارة مقابل الحظ',
  'more.chaos': 'مؤشر الفوضى', 'more.chaosSub': 'متى تلعب بأمان ومتى تغامر', 'more.story': 'بطاقات الستوري', 'more.storySub': 'صور 9:16 جاهزة لإنستغرام',
  'more.deadline': 'وضع الموعد النهائي', 'more.deadlineSub': 'قائمة التحقق الأخيرة', 'more.settings': 'الإعدادات', 'more.settingsSub': 'رقم الفريق واللغة والمظهر',
  new: 'جديد',
  // prices
  'pr.title': 'رادار الأسعار', 'pr.sub': 'مبني على تقدّم تغيّر السعر الذي تنشره FPL وصافي الانتقالات مقابل الملكية.',
  'pr.risers': 'مرشحون للارتفاع', 'pr.fallers': 'مرشحون للانخفاض', 'pr.tonight': 'الليلة', 'pr.progress': 'التقدم',
  'pr.buyBefore': 'اشترِه قبل أن يرتفع', 'pr.sellBefore': 'بِعه قبل أن ينخفض', 'pr.teamValue': 'قيمة فريقك', 'pr.net': 'صافي الانتقالات',
  'pr.yourAlerts': 'تنبيهات تخص فريقك', 'pr.noAlerts': 'لا تغييرات متوقعة على لاعبيك.',
  // differentials
  'df.title': 'اللاعبون المختلفون', 'df.sub': 'مرتبون حسب المكسب المتوقع في الترتيب: نقاط متوقعة (4 جولات) لا يملكها خصومك.',
  'df.sel': 'ملكية عامة', 'df.leagueEo': 'ملكية دوريك', 'df.gain': 'مكسب الترتيب',
  // fixtures
  'fx.title': 'جدول الصعوبة', 'fx.sub': 'من نموذجنا الخاص (xG مع/ضد وقوة الملعب). الجولات المزدوجة مؤطرة والفارغة مخططة.',
  'fx.sortAtt': 'هجوم', 'fx.sortDef': 'دفاع', 'fx.sortAll': 'إجمالي', 'fx.dgw': 'مزدوجة', 'fx.bgw': 'فارغة',
  // chips
  'ch.title': 'مخطط الشرائح', 'ch.sub': 'قيمة كل شريحة لكل جولة من المحاكاة وجدول المباريات.',
  'ch.wildcard': 'البطاقة الحرة', 'ch.freehit': 'الضربة الحرة', 'ch.bboost': 'تعزيز الدكة', 'ch.3xc': 'الكابتن الثلاثي',
  'ch.best': 'أفضل جولة', 'ch.used': 'مستخدمة في هذا النصف', 'ch.available': 'متاحة حتى الجولة {gw}', 'ch.value': '+{v} نقطة متوقعة',
  'ch.noneAvail': 'لا توجد شرائح متاحة الآن — الدفعة الثانية تفتح في الجولة 20.', 'ch.computing': 'نحسب قيم الشرائح…',
  // dream
  'dt.title': 'الفريق الحلم', 'dt.sub': 'أفضل 15 لاعباً تحت الميزانية للجولات القادمة (تحسين بالبحث المحلي).',
  'dt.budget': 'الميزانية', 'dt.gws': 'الجولات', 'dt.build': 'ابنِ الفريق', 'dt.cost': 'التكلفة', 'dt.value': 'المتوقع',
  // injuries
  'in.title': 'الإصابات والتشكيلة', 'in.sub': 'الأخبار الرسمية، احتمال البداية من نموذجنا، وتحذيرات المداورة.',
  'in.mine': 'في فريقك', 'in.start': 'يبدأ', 'in.rotation': 'خطر مداورة', 'in.status.d': 'مشكوك', 'in.status.i': 'مصاب', 'in.status.s': 'موقوف', 'in.status.n': 'غير متاح', 'in.status.a': 'متاح',
  // report
  'rp.title': 'تقرير الجولة', 'rp.vsAvg': 'مقارنة بالمعدل', 'rp.vsTop': 'مقارنة بأفضل 10 آلاف', 'rp.right': 'ما نجح', 'rp.wrong': 'ما أخفق',
  'rp.captain': 'كابتنك {name} جلب {pts} نقطة', 'rp.bestCap': 'أفضل خيار كان {name} ({pts})', 'rp.bench': 'تركت {pts} نقطة على الدكة',
  'rp.best': 'نجمك: {name} ({pts})', 'rp.worst': 'الأسوأ: {name} ({pts})', 'rp.transfer': '{in} ({inPts}) بدل {out} ({outPts})',
  'rp.missed': 'فاتك {name} ({pts} نقطة، ملكية {eo}٪)', 'rp.diffHit': 'رهانك المختلف {name} نجح ({pts})', 'rp.optimal': 'أفضل تشكيلة ممكنة: {pts}',
  'rp.provisional': 'نتائج مؤقتة — قد تتغير نقاط البونص', 'rp.hit': 'خصم {pts} نقاط',
  // hindsight
  'hs.title': 'محرك الأثر الرجعي', 'hs.sub': 'نعيد تشغيل النموذج كما لو كنا قبل كل جولة (بالبيانات المتاحة وقتها فقط) ونقيس النتيجة الحقيقية.',
  'hs.yours': 'نقاطك', 'hs.lineup': 'تشكيلتك بقرارات Edge', 'hs.autopilot': 'Edge على الطيار الآلي', 'hs.rank': 'ترتيب تقريبي',
  'hs.headline': 'لو اتبعت FPL Edge في التشكيلة والكابتن لكان لديك {pts} نقطة وترتيب ≈ {rank}.',
  'hs.accuracy': 'دقة النموذج', 'hs.mae': 'متوسط الخطأ لكل لاعب', 'hs.corr': 'الارتباط', 'hs.capWins': 'كابتن Edge ≥ كابتنك',
  'hs.misses': 'أين أخطأ النموذج', 'hs.autopilotNote': 'الطيار الآلي يبدأ من فريقك في الجولة الأولى، ويجري انتقالاً مجانياً واحداً فقط كل جولة، بدون شرائح.',
  'hs.statusNote': '',
  // journal
  'jr.title': 'سجل القرارات', 'jr.sub': 'نقيّم جودة القرار (النقاط المتوقعة وقتها) بمعزل عن النتيجة.',
  'jr.decision': 'القرار', 'jr.luck': 'الحظ', 'jr.expected': 'متوقع', 'jr.actual': 'فعلي',
  'jr.v.good-good': 'قرار جيد وحظ جيد', 'jr.v.good-bad': 'قرار جيد وحظ سيئ', 'jr.v.bad-good': 'قرار ضعيف وحظ جيد', 'jr.v.bad-bad': 'قرار ضعيف وحظ سيئ',
  'jr.capChoice': 'الكابتن: {cap}', 'jr.capBetter': 'الأفضل حسب النموذج: {best}', 'jr.season': 'الموسم: قرارات {d} وحظ {l}',
  // chaos
  'cx.title': 'مؤشر الفوضى', 'cx.sub': 'توقّع لمدى عشوائية كل جولة من توازن المباريات وتشتت نقاط الفريق الشائع.',
  'cx.calm': 'هادئة', 'cx.normal': 'عادية', 'cx.wild': 'فوضوية', 'cx.safe': 'العب بأمان: الفريق الشائع سيصمد غالباً.',
  'cx.neutral': 'جولة عادية: التزم بالنقاط المتوقعة.', 'cx.gamble': 'غامر إن كنت تطارد: النتائج العشوائية فرصتك.',
  'cx.balance': 'توازن المباريات', 'cx.fragility': 'هشاشة الفريق الشائع', 'cx.capRisk': 'خطر إخفاق الكابتن الشائع', 'cx.irregular': 'جولات مزدوجة/فارغة',
  // story
  'st.title': 'بطاقات الستوري', 'st.sub': 'صورة 9:16 مصممة جاهزة للنشر على ريلز وستوري إنستغرام.',
  'st.gw': 'جولتي', 'st.captain': 'كابتني', 'st.prediction': 'توقعي', 'st.league': 'دوريي', 'st.share': 'مشاركة', 'st.download': 'تنزيل',
  // deadline
  'dl.title': 'وضع الموعد النهائي', 'dl.sub': 'العد التنازلي وقائمة التحقق الأخيرة.',
  'dl.check.news': 'أخبار متأخرة في فريقك', 'dl.check.captain': 'تثبيت الكابتن', 'dl.check.bench': 'ترتيب الدكة', 'dl.check.autosub': 'احتمال دخول كل بديل',
  'dl.allClear': 'لا أخبار مقلقة في تشكيلتك الأساسية', 'dl.capLock': 'الكابتن: {cap} — نائب: {vice}', 'dl.lastHours': 'الساعات الأخيرة: راجع كل شيء الآن',
  // settings
  'set.title': 'الإعدادات', 'set.lang': 'اللغة', 'set.theme': 'المظهر', 'set.dark': 'ليلي', 'set.light': 'نهاري',
  'set.team': 'رقم فريقك',
 
  'set.howUpdates': 'تُحدَّث بيانات اللاعبين والمباريات تلقائياً كل بضع ساعات.',
  // team box
  'team.title': 'فريقك', 'team.placeholder': 'رقم الفريق، مثلاً 1234567', 'team.go': 'اعرض فريقي',
  'team.where': 'تجد الرقم في موقع FPL ← «النقاط»: الرقم بعد ‎/entry/‎ في الرابط.', 'team.change': 'تغيير', 'team.reset': 'إلغاء',
  'team.share': 'انسخ رابطاً لفريقي', 'team.copied': 'تم نسخ الرابط — أرسله لأي شخص', 'team.league': 'الدوري المصغّر',
  'team.notFound': 'لم نجد فريقاً بهذا الرقم. تأكد منه وحاول مجدداً.', 'team.network': 'تعذّر الوصول إلى FPL الآن، فنعرض الفريق الافتراضي. حاول بعد قليل.',
  'team.loading': 'نجلب فريقك ودوريك المصغّر…', 'team.viewing': 'الفريق المعروض', 'team.noLeague': 'لا توجد دوريات خاصة لهذا الفريق.',
  'team.invalid': 'أدخل رقماً صحيحاً', 'team.rivalsLoading': 'نجلب خصومك في الدوري المصغّر… {done}/{total}',
  'team.liteNote': 'قد يستغرق ذلك دقيقة أو دقيقتين في أول مرة، وبعدها يصبح سريعاً.',
  // reasons
  'r.fixture': 'ضد {opp} ({venue})', 'r.double': 'جولة مزدوجة', 'r.blank': 'لا مباراة هذه الجولة', 'r.xg90': 'أهداف متوقعة {v} لكل مباراة', 'r.xa90': 'صناعة متوقعة {v} لكل مباراة',
  'r.start': 'احتمال البداية {v}٪', 'r.cs': 'شباك نظيفة {v}٪', 'r.dc': 'نقاط دفاعية {v}٪', 'r.pens': 'يسدد ركلات الجزاء', 'r.bonus': 'بونص {v} لكل مباراة',
  'r.news': '{v}', 'r.rotation': 'خطر مداورة', H: 'أرض', A: 'خارج',
  'cap.safeExplain': 'آمن: نرتّب حسب أقل مخاطرة — الكابتن الذي يضمن نقاطاً جيدة حتى في الجولة السيئة.',
  'cap.upsideExplain': 'مغامرة: كابتن لا يختاره أغلب خصومك وسقفه عالٍ. إن نجح تقفز عليهم، وإن نجح الكابتن الشائع تخسر أمامهم.',
  'cap.verdict': 'اختيارنا: {name}',
  'cap.pickSafe': 'الأضمن',
  'cap.pickUpside': 'رهان المغامرة',
  'cap.othersCap': 'يختاره خصومك',
  'fx.subFpl': 'صعوبة المباريات بأرقام وألوان موقع الفانتزي الرسمية. الأسهل في الأعلى.',
  'fx.subEdge': 'تقييمنا الخاص لقوة الخصم: «هجوم» لاختيار المهاجمين، و«دفاع» لاختيار المدافعين وحراس المرمى.',
  'fx.sortFpl': 'الفانتزي',
  'fx.easy': 'سهل',
  'fx.hard': 'صعب',
  'rank.title': 'ترتيبي ودورياتي',
  'rank.overall': 'ترتيبك العالمي',
  'rank.myLeagues': 'دورياتي',
  'rank.gwPoints': 'نقاط الجولة',
  'rank.total': 'مجموع النقاط',
  'rank.gwRank': 'ترتيب الجولة',
  'rank.trend': 'مسار ترتيبك خلال الموسم',
  'rank.private': 'دوري خاص',
  'rank.public': 'دوري عام',
  'rank.gwLeague': 'دوري جولة',
  'rank.of': 'من {n} مشارك',
  'rank.analyse': 'حلّل',
  'rank.analysing': 'قيد التحليل',
  'lg.analysisOf': 'تحليل دوري: {name}',
  'tr.bestTitle': 'أنسب التبديلات لتشكيلتك',
  'tr.bestSub': 'حسب رصيدك (£{bank}m) وانتقالاتك المجانية ({ft})، محسوبة للست جولات القادمة.',
  'tr.bankAfter': 'رصيدك بعدها',
  'tr.pts6': 'نقطة إضافية متوقعة',
  'tr.apply': 'جرّبها',
  'tr.tapHint': 'أو المس أي لاعب في تشكيلتك تحت لترى أفضل بدلائه ضمن رصيدك.',
  'tr.replacementsFor': 'أفضل بدلاء {name}',
  'tr.budgetFor': 'ضمن رصيدك: حتى £{money}m',
  'tr.vsOut': 'نقطة أكثر منه',
  'tr.planTitle': 'خطة الجولات القادمة',
  'tr.planHint': 'المس جولة لترى تشكيلتك فيها. اسحب الانتقال بين الجولات لتغيير موعده.',
  'set.dataTitle': 'البيانات',
  'set.lastUpdate': 'آخر تحديث لبيانات اللاعبين',
  'set.install': 'ثبّته كتطبيق: من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية».',
  'why': 'لماذا؟',
};

const en: Dict = {
  appName: 'FPL Edge',
  tagline: 'Your edge over the mini-league',
  'tab.home': 'Home', 'tab.captain': 'Captain', 'tab.transfers': 'Transfers', 'tab.league': 'League', 'tab.more': 'More',
  loading: 'Setting up the pitch…', loadingSim: 'Simulating the gameweek 10,000 times…', loadError: 'Could not load data', loadErrorHint: 'Check your internet connection and try again.', retry: 'Retry',
  offline: 'You are offline — showing the last saved data',
  updated: 'Updated', gw: 'GW', gwShort: 'GW', deadline: 'Deadline', deadlinePassed: 'Deadline passed',
  days: 'days', hours: 'hrs', minutes: 'min', seconds: 'sec',
  demoTitle: 'Welcome to FPL Edge',
  demoSlim: 'This is an example — tap to enter your team ID', demoShort: 'Enter your team ID to see your analysis. Showing an example for now: ',
  points: 'pts', pts: 'pts', xPts: 'Expected points', xp: 'xP',
  median: 'Median', range: '10–90% range', p10: 'Worst 10%', p90: 'Best 10%',
  pGoal: 'Goal', pAssist: 'Assist', pCS: 'Clean sheet', p10plus: '10+ pts', pBlank: 'Blank (≤2)',
  'home.captain': 'Recommended captain', 'home.transfer': 'Top transfer', 'home.winProb': 'League win probability',
  'home.chaos': 'Chaos index', 'home.squad': 'Your squad this GW', 'home.report': 'Last gameweek report',
  'home.noTransfer': 'No transfer worth making — roll it', 'home.seeAll': 'See all', 'home.leagueRank': 'League position',
  'home.deadlineMode': 'Deadline mode', 'home.story': 'Story card',
  'cap.title': 'Captain picker', 'cap.sub': 'How many points could each option bring? From 10,000 simulations of the gameweek; captain points doubled.',
  'cap.safe': 'Safe', 'cap.upside': 'Upside', 'cap.mean': 'Expected pts', 'cap.leagueEo': 'Rivals own', 'cap.topEo': 'Top 10k captaincy',
  'cap.safeHint': 'Safe favours a high floor (p10 and median); upside favours the ceiling (p90 and P(10+)).',
  'cap.pick': 'Edge pick',
  'tr.title': 'Transfer planner', 'tr.sub': 'Plan six gameweeks: drag a player from the list onto a squad player, or tap a player then the replacement.',
  'tr.bank': 'Bank', 'tr.ft': 'Free transfers', 'tr.hits': 'Hits', 'tr.projected': 'Projected', 'tr.vsBaseline': 'vs no transfers',
  'tr.optimizer': 'Optimizer', 'tr.optSub': 'Best 1, 2 or 3 moves for your bank and free transfers.', 'tr.horizon': 'Horizon',
  'tr.moves': 'moves', 'tr.gain': 'Gain', 'tr.net': 'Net', 'tr.add': 'Add to plan', 'tr.clear': 'Clear plan',
  'tr.hitValue': 'True value of a −4', 'tr.hitWorth': 'The extra move adds {gain} pts against a 4-pt hit — {verdict}',
  'tr.worth': 'worth it', 'tr.notWorth': 'not worth it', 'tr.search': 'Search player…', 'tr.selectOut': 'Pick a player to sell', 'tr.selected': 'Selling {name} — pick a replacement',
  'tr.problem.budget': 'Not enough money', 'tr.problem.teamLimit': 'More than 3 from one club', 'tr.problem.position': 'Different position',
  'tr.dragHint': 'Drag transfers between gameweeks to retime them', 'tr.noSquad': 'No squad available yet.', 'tr.all': 'All',
  'tr.chip': 'Chip', 'tr.none': 'None', 'tr.sell': 'Sell price', 'tr.undo': 'Undo',
  'lg.title': 'Mini-league', 'lg.standings': 'Table', 'lg.dial': 'Risk', 'lg.rivals': 'Rivals', 'lg.eo': 'What if',
  'lg.dialTitle': 'Risk dial', 'lg.rivalsTitle': 'Rival DNA',
  'lg.pWin': 'Wins title', 'lg.pLead': 'Leads after GW', 'lg.expRank': 'Exp. rank', 'lg.total': 'Total', 'lg.gap': 'Gap',
  'lg.you': 'You', 'lg.demoNote': 'Example: the world’s top 20 managers as a mini-league. Enter your team ID to see your real league.',
  'lg.mode.protect': 'Protect', 'lg.mode.balanced': 'Balanced', 'lg.mode.attack': 'Attack',
  'lg.modeExplain.protect': 'You lead: cover your rivals’ effective ownership and reduce variance.',
  'lg.modeExplain.balanced': 'It’s tight: follow the highest expected points.',
  'lg.modeExplain.attack': 'You’re chasing: add variance and back players your rivals don’t own.',
  'lg.dialSub': 'We optimise your chance of winning the league, not just points. Move the dial to see recommendations change.',
  'lg.moveImpact': 'How each move changes your win probability', 'lg.before': 'Now', 'lg.after': 'After',
  'lg.whatIf': 'What if?', 'lg.whatIfSub': 'Pick a player to see where you’d be after the GW if he blanks or hauls.',
  'lg.ifBlank': 'If {name} blanks you’ll be ~{rank}', 'lg.ifHaul': 'If {name} hauls you’ll be ~{rank}',
  'lg.eoTable': 'Effective ownership among your rivals', 'lg.own': 'You own', 'lg.notOwn': 'Not owned',
  'lg.captaincy': 'Captaincy', 'lg.style.template': 'Template', 'lg.style.balanced': 'Balanced', 'lg.style.contrarian': 'Contrarian',
  'lg.hits': 'Hits', 'lg.chaser': 'Chases hauls', 'lg.notChaser': 'Doesn’t chase', 'lg.bank': 'Avg bank', 'lg.chipsLeft': 'Chips left',
  'lg.predCaptain': 'Likely captain', 'lg.predIn': 'Might buy', 'lg.predOut': 'Might sell', 'lg.beat': 'P(pass them)', 'lg.howToBeat': 'How to beat them',
  'lg.perGw': 'transfers/GW', 'lg.avgPts': 'Avg pts', 'lg.capHit': 'Captain hit rate', 'lg.bench': 'Bench pts/GW',
  'more.title': 'More', 'more.prices': 'Price radar', 'more.pricesSub': 'Who rises and falls tonight',
  'more.diffs': 'Differentials', 'more.diffsSub': 'High xP, low ownership', 'more.fixtures': 'Fixture ticker', 'more.fixturesSub': '8-GW difficulty grid',
  'more.chips': 'Chip planner', 'more.chipsSub': 'Best GW for each chip', 'more.dream': 'Dream team', 'more.dreamSub': 'Optimal 15 on your budget',
  'more.injuries': 'Injury & lineup watch', 'more.injuriesSub': 'News and start odds', 'more.report': 'GW report', 'more.reportSub': 'What went right and wrong',
  'more.hindsight': 'Hindsight engine', 'more.hindsightSub': 'If you’d followed FPL Edge', 'more.journal': 'Decision journal', 'more.journalSub': 'Skill vs luck',
  'more.chaos': 'Chaos index', 'more.chaosSub': 'When to play safe or gamble', 'more.story': 'Story cards', 'more.storySub': '9:16 images for Instagram',
  'more.deadline': 'Deadline mode', 'more.deadlineSub': 'Final checklist', 'more.settings': 'Settings', 'more.settingsSub': 'Team ID, language, theme',
  new: 'New',
  'pr.title': 'Price radar', 'pr.sub': 'Built on FPL’s published price-change progress and net transfers vs ownership.',
  'pr.risers': 'Likely risers', 'pr.fallers': 'Likely fallers', 'pr.tonight': 'Tonight', 'pr.progress': 'Progress',
  'pr.buyBefore': 'Buy before it rises', 'pr.sellBefore': 'Sell before it drops', 'pr.teamValue': 'Team value', 'pr.net': 'Net transfers',
  'pr.yourAlerts': 'Alerts for your squad', 'pr.noAlerts': 'No price changes expected for your players.',
  'df.title': 'Differentials', 'df.sub': 'Ranked by expected rank gain: projected points (4 GWs) your rivals don’t own.',
  'df.sel': 'Selected', 'df.leagueEo': 'League EO', 'df.gain': 'Rank gain',
  'fx.title': 'Fixture ticker', 'fx.sub': 'From our own model (xG for/against, venue). Doubles are outlined, blanks hatched.',
  'fx.sortAtt': 'Attack', 'fx.sortDef': 'Defence', 'fx.sortAll': 'Overall', 'fx.dgw': 'Double', 'fx.bgw': 'Blank',
  'ch.title': 'Chip planner', 'ch.sub': 'Value of each chip per gameweek from the simulations and fixtures.',
  'ch.wildcard': 'Wildcard', 'ch.freehit': 'Free Hit', 'ch.bboost': 'Bench Boost', 'ch.3xc': 'Triple Captain',
  'ch.best': 'Best GW', 'ch.used': 'Used this half', 'ch.available': 'Available until GW{gw}', 'ch.value': '+{v} expected pts',
  'ch.noneAvail': 'No chips available right now — the second set opens in GW20.', 'ch.computing': 'Computing chip values…',
  'dt.title': 'Dream team', 'dt.sub': 'The best 15 under budget for the next gameweeks (local-search optimisation).',
  'dt.budget': 'Budget', 'dt.gws': 'Gameweeks', 'dt.build': 'Build', 'dt.cost': 'Cost', 'dt.value': 'Projected',
  'in.title': 'Injury & lineup watch', 'in.sub': 'Official news, our start probability, and rotation warnings.',
  'in.mine': 'In your team', 'in.start': 'Starts', 'in.rotation': 'Rotation risk', 'in.status.d': 'Doubtful', 'in.status.i': 'Injured', 'in.status.s': 'Suspended', 'in.status.n': 'Unavailable', 'in.status.a': 'Available',
  'rp.title': 'Gameweek report', 'rp.vsAvg': 'vs average', 'rp.vsTop': 'vs top 10k', 'rp.right': 'What went right', 'rp.wrong': 'What went wrong',
  'rp.captain': 'Your captain {name} returned {pts}', 'rp.bestCap': 'Best option was {name} ({pts})', 'rp.bench': 'You left {pts} pts on the bench',
  'rp.best': 'Star: {name} ({pts})', 'rp.worst': 'Weakest: {name} ({pts})', 'rp.transfer': '{in} ({inPts}) for {out} ({outPts})',
  'rp.missed': 'You missed {name} ({pts} pts, {eo}% EO)', 'rp.diffHit': 'Your differential {name} delivered ({pts})', 'rp.optimal': 'Best possible lineup: {pts}',
  'rp.provisional': 'Provisional — bonus may still change', 'rp.hit': '{pts}-pt hit',
  'hs.title': 'Hindsight engine', 'hs.sub': 'We replay the model as of each deadline (only data available then) and score it with what actually happened.',
  'hs.yours': 'Your points', 'hs.lineup': 'Your squads, Edge decisions', 'hs.autopilot': 'Edge on autopilot', 'hs.rank': 'Approx. rank',
  'hs.headline': 'Following FPL Edge for lineups and captains you’d have {pts} points and rank ≈ {rank}.',
  'hs.accuracy': 'Model accuracy', 'hs.mae': 'Mean abs. error per player', 'hs.corr': 'Correlation', 'hs.capWins': 'Edge captain ≥ yours',
  'hs.misses': 'Where the model was wrong', 'hs.autopilotNote': 'Autopilot starts from your GW1 squad and makes one free transfer at most each gameweek, with no chips.',
  'hs.statusNote': '',
  'jr.title': 'Decision journal', 'jr.sub': 'We grade decision quality (expected points at the time) separately from the outcome.',
  'jr.decision': 'Decision', 'jr.luck': 'Luck', 'jr.expected': 'Expected', 'jr.actual': 'Actual',
  'jr.v.good-good': 'Good decision, good luck', 'jr.v.good-bad': 'Good decision, bad luck', 'jr.v.bad-good': 'Weak decision, good luck', 'jr.v.bad-bad': 'Weak decision, bad luck',
  'jr.capChoice': 'Captain: {cap}', 'jr.capBetter': 'Model’s best: {best}', 'jr.season': 'Season: decisions {d}, luck {l}',
  'cx.title': 'Chaos index', 'cx.sub': 'How random each gameweek is likely to be, from fixture balance and template variance.',
  'cx.calm': 'Calm', 'cx.normal': 'Normal', 'cx.wild': 'Wild', 'cx.safe': 'Play safe: the template should hold.',
  'cx.neutral': 'A normal week: stick to expected points.', 'cx.gamble': 'Gamble if chasing: randomness is your friend.',
  'cx.balance': 'Fixture balance', 'cx.fragility': 'Template fragility', 'cx.capRisk': 'Template captain blank risk', 'cx.irregular': 'Doubles / blanks',
  'st.title': 'Story cards', 'st.sub': 'A designed 9:16 image ready for Reels and Instagram Stories.',
  'st.gw': 'My GW', 'st.captain': 'My captain', 'st.prediction': 'My prediction', 'st.league': 'My league', 'st.share': 'Share', 'st.download': 'Download',
  'dl.title': 'Deadline mode', 'dl.sub': 'Countdown and the final checklist.',
  'dl.check.news': 'Late news in your team', 'dl.check.captain': 'Captain lock', 'dl.check.bench': 'Bench order', 'dl.check.autosub': 'Auto-sub probability per bench player',
  'dl.allClear': 'No worrying news in your starting XI', 'dl.capLock': 'Captain: {cap} — vice: {vice}', 'dl.lastHours': 'Final hours: check everything now',
  'set.title': 'Settings', 'set.lang': 'Language', 'set.theme': 'Theme', 'set.dark': 'Night', 'set.light': 'Day',
  'set.team': 'Your team ID',
 
  'set.howUpdates': 'Player and fixture data refresh automatically every few hours.',
  'team.title': 'Your team', 'team.placeholder': 'Team ID, e.g. 1234567', 'team.go': 'Show my team',
  'team.where': 'Find it on the FPL site → Points: the number after /entry/ in the URL.', 'team.change': 'Change', 'team.reset': 'Remove',
  'team.share': 'Copy a link to my team', 'team.copied': 'Link copied — send it to anyone', 'team.league': 'Mini-league',
  'team.notFound': 'No team with that ID. Check it and try again.', 'team.network': 'Couldn’t reach FPL right now, so the default team is shown. Try again shortly.',
  'team.loading': 'Fetching your team and mini-league…', 'team.viewing': 'Showing', 'team.noLeague': 'This team has no private leagues.',
  'team.invalid': 'Enter a valid number', 'team.rivalsLoading': 'Loading your mini-league rivals… {done}/{total}',
  'team.liteNote': 'This can take a minute or two the first time; after that it’s quick.',
  'r.fixture': 'vs {opp} ({venue})', 'r.double': 'Double gameweek', 'r.blank': 'No fixture this GW', 'r.xg90': '{v} expected goals per game', 'r.xa90': '{v} expected assists per game',
  'r.start': '{v}% start probability', 'r.cs': '{v}% clean sheet', 'r.dc': '{v}% defensive points', 'r.pens': 'On penalties', 'r.bonus': '{v} bonus per game',
  'r.news': '{v}', 'r.rotation': 'Rotation risk', H: 'H', A: 'A',
  'cap.safeExplain': 'Safe: ranked by lowest risk — the captain who still returns decent points in a bad week.',
  'cap.upsideExplain': 'Upside: a captain most rivals don’t have, with a high ceiling. If he hauls you leap past them; if the popular pick hauls instead, you lose ground.',
  'cap.verdict': 'Our pick: {name}',
  'cap.pickSafe': 'Safest',
  'cap.pickUpside': 'Upside punt',
  'cap.othersCap': 'Rivals captain',
  'fx.subFpl': 'Fixture difficulty using the official FPL numbers and colours. Easiest at the top.',
  'fx.subEdge': 'Our own opponent rating: “Attack” for picking forwards, “Defence” for defenders and keepers.',
  'fx.sortFpl': 'FPL',
  'fx.easy': 'Easy',
  'fx.hard': 'Hard',
  'rank.title': 'My ranks & leagues',
  'rank.overall': 'Overall rank',
  'rank.myLeagues': 'My leagues',
  'rank.gwPoints': 'GW points',
  'rank.total': 'Total points',
  'rank.gwRank': 'GW rank',
  'rank.trend': 'Your rank this season',
  'rank.private': 'Private league',
  'rank.public': 'Public league',
  'rank.gwLeague': 'Gameweek league',
  'rank.of': 'of {n}',
  'rank.analyse': 'Analyse',
  'rank.analysing': 'Analysing',
  'lg.analysisOf': 'League analysis: {name}',
  'tr.bestTitle': 'Best transfers for your squad',
  'tr.bestSub': 'For your bank (£{bank}m) and free transfers ({ft}), over the next six gameweeks.',
  'tr.bankAfter': 'Bank after',
  'tr.pts6': 'extra expected pts',
  'tr.apply': 'Try it',
  'tr.tapHint': 'Or tap any player in your squad below to see his best replacements within budget.',
  'tr.replacementsFor': 'Best replacements for {name}',
  'tr.budgetFor': 'Within budget: up to £{money}m',
  'tr.vsOut': 'pts vs him',
  'tr.planTitle': 'Plan the coming gameweeks',
  'tr.planHint': 'Tap a gameweek to see your squad then. Drag a transfer between gameweeks to move it.',
  'set.dataTitle': 'Data',
  'set.lastUpdate': 'Player data last updated',
  'set.install': 'Install it as an app: in your browser menu choose “Add to Home Screen”.',
  'why': 'Why?',
};

const dicts: Record<Lang, Dict> = { ar, en };

export type T = (key: string, params?: Record<string, string | number>) => string;

function makeT(lang: Lang): T {
  return (key, params) => {
    let s = dicts[lang][key] ?? dicts.en[key] ?? key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

interface I18n { lang: Lang; t: T; setLang: (l: Lang) => void; fmt: (n: number, d?: number) => string; pct: (p: number, d?: number) => string; reason: (r: Reason) => string }

const Ctx = createContext<I18n | null>(null);

const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (safeGet('fpl-edge-lang') as Lang) || 'ar');
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);
  const value = useMemo<I18n>(() => {
    const t = makeT(lang);
    // Western digits read best for stats in both languages (and match FPL itself).
    const fmt = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '—');
    const pct = (p: number, d = 0) => `${(p * 100).toFixed(d)}%`;
    const reason = (r: Reason) => {
      const params = { ...r.params } as Record<string, string | number>;
      if (r.key === 'fixture') params.venue = t(String(r.params.venue));
      return t(`r.${r.key}`, params);
    };
    return { lang, t, setLang: (l) => { safeSet('fpl-edge-lang', l); setLangState(l); }, fmt, pct, reason };
  }, [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('I18nProvider missing');
  return v;
}

export { safeGet, safeSet };
