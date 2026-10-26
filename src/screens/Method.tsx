import { useI18n } from '../i18n';
import { useStore } from '../store';
import { PageHeader } from '../components/ui';

type Section = { title: string; body: string[] };

function content(lang: 'ar' | 'en', gw: number, to: number, mae: string | null): Section[] {
  if (lang === 'en') return [
    { title: 'Where does the data come from?', body: [
      'Everything comes from the official Fantasy Premier League site: every player’s points, minutes, goals and assists, expected goals and assists (xG/xA), injury news, prices, ownership and the fixture list.',
      'Player and fixture data refresh automatically every 6 hours, and every hour on deadline day. Your own team and leagues are read from your public FPL profile when you enter your team ID.',
    ] },
    { title: 'Which gameweek do the predictions mean?', body: [
      `Every prediction is for the next gameweek whose deadline hasn’t passed — currently GW${gw}. Transfer advice looks at GW${gw} to GW${to}. Each card says which gameweek it means.`,
    ] },
    { title: 'How do we predict a player’s points?', body: [
      'For every fixture we combine five things:',
      '1) Will he play? From his recent starts and minutes, the official “chance of playing” and injury news.',
      '2) How strong are the two teams? For every team we measure attack and defence from the expected goals it created and conceded in each match this season (recent matches count more), plus home advantage.',
      '3) His share of his team’s goals and assists, from his expected goals and assists per 90 minutes.',
      '4) Clean-sheet chances from how many goals the opponent is expected to score.',
      '5) Bonus and defensive-contribution points from his record this season.',
      'Then we apply the official FPL scoring rules for his position.',
    ] },
    { title: 'Why 10,000 simulations?', body: [
      'We play the gameweek out 10,000 times on the computer. In each run every match gets a scoreline, and the goals and assists go to players according to their chances. So instead of one number you see the full picture: the median, the worst 10%, the best 10% and the chance of 10+ points.',
    ] },
    { title: 'Fixture colours', body: [
      '“FPL” uses the official FPL difficulty numbers and colours (1 easiest → 5 hardest), exactly as on the FPL site.',
      '“Attack” and “Defence” are our own ratings from this season’s expected-goals numbers: Attack = how easy it is to score against that opponent (for forwards and midfielders), Defence = how easy it is to keep a clean sheet against them (for defenders and keepers). They come from match data, not guesswork.',
    ] },
    { title: 'Transfer advice', body: [
      'We try every possible transfer within your bank and the three-per-club rule. For each one we pick your best starting XI and captain in each of the next six gameweeks, and keep the moves that add the most expected points. An extra transfer costs 4 points, so we tell you whether it’s worth it.',
    ] },
    { title: 'Mini-league and “what if”', body: [
      'In your mini-league we simulate the gameweek for all your rivals’ real squads at once, so we know exactly where you’d be if a player blanks or hauls.',
      'For the world rank we can’t see 11 million squads, so we estimate it from each player’s global ownership. That figure is a rough guide, not an exact number.',
    ] },
    { title: 'Decision journal', body: [
      'We rerun the predictions as they were before each deadline, without knowing the result. A good decision means you chose what was best on the information available then. Luck is the gap between the points you actually scored and the points expected.',
    ] },
    { title: 'Is it guaranteed?', body: [
      `No — football is random. ${mae ? `Tested on this season, the average error per player is about ${mae} points per gameweek. ` : ''}Predictions get sharper as the season goes on. Use them as strong advice, and the final call is yours.`,
    ] },
  ];
  return [
    { title: 'من أين البيانات؟', body: [
      'كل البيانات من موقع الفانتزي الرسمي: نقاط كل لاعب ودقائقه وأهدافه وتمريراته، والأهداف والتمريرات المتوقعة (xG وxA)، وأخبار الإصابات، والأسعار، ونسب الامتلاك، وجدول المباريات.',
      'بيانات اللاعبين والمباريات تتحدّث تلقائياً كل 6 ساعات، وكل ساعة في يوم الموعد النهائي. أما فريقك ودورياتك فتُقرأ من صفحتك العامة في الفانتزي عند إدخال رقم فريقك.',
    ] },
    { title: 'أي جولة نقصد في التوقعات؟', body: [
      `كل التوقعات للجولة القادمة التي لم يُغلق موعدها بعد، وهي الآن الجولة ${gw}. نصائح الانتقالات تحسب من الجولة ${gw} إلى الجولة ${to}، وكل بطاقة مكتوب عليها الجولة التي تقصدها.`,
    ] },
    { title: 'كيف نتوقع نقاط اللاعب؟', body: [
      'لكل مباراة نجمع خمسة أشياء:',
      '1) هل سيلعب؟ من بداياته ودقائقه في آخر المباريات، ونسبة «احتمال المشاركة» الرسمية، وأخبار الإصابات.',
      '2) قوة الفريقين: نقيس لكل فريق قوته الهجومية والدفاعية من الأهداف المتوقعة التي صنعها واستقبلها في كل مباراة هذا الموسم (المباريات الأخيرة وزنها أكبر)، مع أفضلية اللعب على الأرض.',
      '3) نصيب اللاعب من أهداف فريقه وتمريراته الحاسمة، من أهدافه وتمريراته المتوقعة لكل 90 دقيقة.',
      '4) فرصة الشباك النظيفة، من عدد الأهداف المتوقع أن يسجلها الخصم.',
      '5) البونص ونقاط المساهمة الدفاعية، من سجله هذا الموسم.',
      'ثم نطبّق قواعد نقاط الفانتزي الرسمية حسب مركزه.',
    ] },
    { title: 'لماذا 10,000 محاكاة؟', body: [
      'نلعب الجولة على الكمبيوتر 10,000 مرة. في كل مرة تأخذ كل مباراة نتيجة، وتُوزَّع الأهداف والتمريرات على اللاعبين حسب فرصهم. لذلك بدل رقم واحد ترى الصورة كاملة: النقاط المتوقعة، وأسوأ 10٪ من الحالات، وأفضل 10٪، واحتمال +10 نقاط.',
    ] },
    { title: 'ألوان جدول الصعوبة', body: [
      '«الفانتزي» هي أرقام الصعوبة الرسمية وألوانها (1 الأسهل ← 5 الأصعب)، كما تظهر في موقع الفانتزي بالضبط.',
      '«هجوم» و«دفاع» تقييمنا الخاص من أرقام الأهداف المتوقعة لهذا الموسم: «هجوم» تعني كم يسهل التسجيل على هذا الخصم (لاختيار المهاجمين ولاعبي الوسط)، و«دفاع» كم يسهل الحفاظ على شباك نظيفة أمامه (للمدافعين والحراس). ليست تخميناً، بل مبنية على أرقام المباريات.',
    ] },
    { title: 'نصائح الانتقالات', body: [
      'نجرّب كل انتقال ممكن ضمن رصيدك وقاعدة 3 لاعبين من النادي نفسه. لكل انتقال نختار أفضل تشكيلة أساسية وكابتن في كل جولة من الجولات الست القادمة، ونرشّح الانتقالات التي تزيد نقاطك المتوقعة أكثر. الانتقال الإضافي يكلفك 4 نقاط، فنخبرك إن كان يستحق.',
    ] },
    { title: 'الدوري المصغّر و«ماذا لو»', body: [
      'داخل دوريك نحاكي الجولة لكل خصومك بتشكيلاتهم الحقيقية في الوقت نفسه، فنعرف بالضبط أين ستكون إن أخفق لاعب أو تألق.',
      'في الترتيب العالمي لا نملك تشكيلات 11 مليون مدير، فنقدّر الترتيب من نسبة امتلاك كل لاعب في العالم. هذا الرقم تقدير تقريبي وليس دقيقاً.',
    ] },
    { title: 'سجل القرارات', body: [
      'نعيد التوقعات كما كانت قبل كل موعد نهائي، دون معرفة النتيجة. «القرار الجيد» يعني أنك اخترت الأفضل حسب المعلومات المتوفرة وقتها. و«الحظ» هو الفرق بين نقاطك الفعلية والنقاط المتوقعة.',
    ] },
    { title: 'هل هي مضمونة؟', body: [
      `لا، فكرة القدم فيها عشوائية. ${mae ? `في اختبارنا على هذا الموسم، متوسط الخطأ لكل لاعب نحو ${mae} نقطة في الجولة. ` : ''}التوقعات تتحسن مع تقدّم الموسم. اعتبرها نصيحة قوية، والقرار الأخير لك.`,
    ] },
  ];
}

export function Method() {
  const { t, lang } = useI18n();
  const { analysis: a, phase2 } = useStore();
  if (!a) return null;
  const mae = phase2?.backtest ? phase2.backtest.accuracy.mae.toFixed(1) : null;
  const sections = content(lang, a.gw, a.horizon[Math.min(5, a.horizon.length - 1)], mae);
  return (
    <div>
      <PageHeader title={t('method.title')} back="#/more" />
      <div className="stack">
        {sections.map((s) => (
          <article key={s.title} className="card">
            <h2 className="section-title" style={{ margin: '0 0 6px' }}>{s.title}</h2>
            {s.body.map((p, i) => <p key={i} style={{ margin: '0 0 8px', lineHeight: 1.8 }}>{p}</p>)}
          </article>
        ))}
      </div>
    </div>
  );
}
