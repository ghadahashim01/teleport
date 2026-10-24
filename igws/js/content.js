// محتوى المشاهد — كل نص هنا إما حقيقة منشورة (مع مصدرها)، أو شرح علمي عام، أو مقترح للتقييم بوسم واضح.
// layout: hero | side | split | wide

const SRC = {
  cmc: '<a class="src" href="https://cmc.iq/wp-content/uploads/2025/08/Regulation-on-the-licensing-of-ground-stations-for-space-services-English-language.pdf" target="_blank" rel="noopener">تعليمات هيأة الإعلام والاتصالات</a>',
  moc: '<span class="src">كتاب وزارة الاتصالات – مكتب الوزير، تشرين الأول 2026</span>',
  inv: '<span class="src">دعوة حفل الافتتاح</span>',
  mot: '<span class="src">صفحة وزارة النقل، 22 تشرين الأول 2026</span>',
};

const VERIFY = '<span class="tag tag-verify">يتطلب التحقق من الجهة المختصة</span>';
const PROPOSED = '<span class="tag tag-prop">فرصة مقترحة للتقييم</span>';

export const SCENES = [
  {
    id: 'gate', label: 'الافتتاحية', layout: 'hero',
    html: `
      <div class="hero-logo top-logo" data-logo></div>
      <p class="eyebrow">IGWS – Teleport · Iraq Space Connectivity × Transportation</p>
      <h1 class="hero-title approved">ملتقى تكنولوجيا الفضاء وإطلاق أول محطة أرضية للأقمار الصناعية في العراق</h1>
      <p class="hero-sub">الفرص والتطبيقات المحتملة في تشكيلات وزارة النقل العراقية</p>
      <p class="credit credit-hero"><span class="cr-k">إعداد</span><span class="cr-n">المهندسة غادة هاشم</span></p>`
  },
  {
    id: 'why', label: 'ما المحطة الأرضية؟', layout: 'side',
    kicker: '٠٢ · التعريف',
    title: 'ما المحطة الأرضية للأقمار الصناعية؟',
    html: `
      <p class="idea idea-sm" data-at="0.6"><b>المحطة الأرضية للاتصالات الفضائية</b> منظومة من الهوائيات والأجهزة الإلكترونية وأنظمة التحكم والاتصال، تتيح إرسال البيانات إلى الأقمار الصناعية واستقبالها منها، وربط الاتصالات الفضائية بالشبكات الأرضية وفقاً للخدمات والتجهيزات المتاحة.</p>
      <div class="tri">
        <div data-at="6.4" class="hot"><span class="tri-k">على الأرض</span><b>الهوائي</b><small>يرسل الإشارات الراديوية نحو القمر الصناعي ويستقبل الإشارات الواردة منه.</small></div>
        <div data-at="7.8"><span class="tri-k">داخل المحطة</span><b>أنظمة المحطة</b><small>معالجة الإشارات والتحكم بالاتصال وتمرير البيانات بحسب تصميم المنظومة.</small></div>
        <div data-at="9.4"><span class="tri-k">في الفضاء</span><b>القمر الصناعي</b><small>ينقل الإشارات بين المحطة والوجهات الأخرى وفق نوع الخدمة.</small></div>
      </div>
      <p class="keyline" data-at="11.0">المحطة الأرضية جزء من منظومة الاتصالات الفضائية، وليست قمراً صناعياً.</p>`
  },

  {
    id: 'how', label: 'مسار البيانات', layout: 'side',
    kicker: '٠٣ · آلية العمل',
    title: 'كيف تنتقل البيانات من القمر الصناعي إلى الجهة المستفيدة؟',
    html: `
      <ol class="signal-steps compact path5">
        <li data-at="1.4" data-step="0"><span class="sn">١</span><span><b>القمر الصناعي</b><small>في المدار</small></span></li>
        <li data-at="2.6" data-step="1"><span class="sn">٢</span><span><b>الوصلة الراديوية</b><small>إشارة لاسلكية بين القمر والمحطة</small></span></li>
        <li data-at="3.8" data-step="2"><span class="sn">٣</span><span><b>هوائي المحطة وأجهزتها</b><small>استقبال الإشارة وإرسالها</small></span></li>
        <li data-at="5.6" data-step="3"><span class="sn">٤</span><span><b>بوابة الاتصالات والشبكة الأرضية</b><small>تمرير البيانات عبر التجهيزات والشبكات</small></span></li>
        <li data-at="8.4" data-step="4"><span class="sn">٥</span><span><b>الجهة المستفيدة</b><small>تتلقى الخدمة</small></span></li>
      </ol>
      <p class="fn-line" data-at="10.2"><b>⇅ الاتجاهان:</b> تُرسَل البيانات بالمسار المعاكس عند الإرسال من الجهة المستفيدة.</p>
      <p class="note" data-at="10.8">نموذج توضيحي عام؛ تختلف البنية الداخلية من محطة إلى أخرى.</p>`
  },

  {
    id: 'contrib', label: 'ما الذي تقدمه المحطة؟', layout: 'side',
    kicker: '٠٤ · دور المحطة',
    title: 'ما الذي يمكن أن تقدّمه المحطة الأرضية؟',
    html: `
      <ul class="facts-ico">
        <li data-at="1.0"><i class="sx sx-sat"></i><span><b>إرسال الإشارات واستقبالها</b>بحسب تجهيز المحطة والخدمة</span></li>
        <li data-at="2.4"><i class="sx sx-gov"></i><span><b>تمرير البيانات عبر الشبكات</b>من خلال البنية الشبكية المناسبة</span></li>
        <li data-at="3.8"><i class="sx sx-plane"></i><span><b>تمكين الاتصال الفضائي</b>للمواقع والجهات وفق التغطية</span></li>
        <li data-at="5.2"><i class="sx sx-alert"></i><span><b>دعم الخدمات المخوّلة</b>وفق الإعداد الفعلي للنظام والترخيص</span></li>
      </ul>
      <div class="kinds4" data-at="6.8">
        <div class="k-com"><b>اتصالات فضائية</b><small>نقل الإشارات والبيانات بين نقاط على الأرض. <em>مجال المحطة المعلن</em></small></div>
        <div><b>الاستشعار عن بُعد</b><small>صور وبيانات عن سطح الأرض، بأقمار وأنظمة استقبال مختلفة.</small></div>
        <div><b>الملاحة وتحديد المواقع</b><small>إشارات مثل <span class="latin">GPS</span> يستقبلها المستخدم مباشرة.</small></div>
        <div><b>الأرصاد الجوية</b><small>أقمار ومحطات رصد وأنظمة تحليل متخصصة.</small></div>
      </div>
      <p class="note" data-at="8.2">لا تُنسب للمحطة قدرات استقبال أو تصوير أو رصد دون التحقق من تجهيزاتها؛ والتحليل المتقدم يجري غالباً في أنظمة أو جهات أخرى.</p>`
  },
  {
    id: 'sectors', label: 'أهميتها للقطاعات', layout: 'side',
    kicker: '٠٥ · أهمية عامة',
    title: 'أهمية المحطات الأرضية في دعم القطاعات المختلفة',
    html: `
      <div class="sx-grid">
        <div class="sx-card" data-at="1.4"><i class="sx sx-plane" aria-hidden="true"></i><b>النقل والطيران</b><small>نقل البيانات والاتصال التشغيلي حيث تتوفر الخدمة المناسبة.</small></div>
        <div class="sx-card" data-at="2.3"><i class="sx sx-weather" aria-hidden="true"></i><b>الأنواء الجوية</b><small>ربط محطات الرصد البعيدة بمراكز البيانات؛ واستقبال صور الأقمار الجوية مباشرةً يتطلب التحقق من المصدر والتجهيزات.</small></div>
        <div class="sx-card" data-at="3.2"><i class="sx sx-ship" aria-hidden="true"></i><b>الموانئ والنقل البحري</b><small>دعم الاتصالات وتبادل بيانات العمليات.</small></div>
        <div class="sx-card" data-at="4.1"><i class="sx sx-leaf" aria-hidden="true"></i><b>الزراعة والبيئة</b><small>نقل البيانات من المواقع الميدانية، وهو غير استقبال صور الاستشعار عن بُعد.</small></div>
        <div class="sx-card" data-at="5.0"><i class="sx sx-gov" aria-hidden="true"></i><b>المؤسسات الحكومية</b><small>ربط المواقع البعيدة وفق متطلبات الخدمة والأمن.</small></div>
        <div class="sx-card" data-at="5.9"><i class="sx sx-alert" aria-hidden="true"></i><b>إدارة الطوارئ</b><small>إمكانية مسار اتصال بديل عند توافر الخدمة والتجهيزات المناسبة.</small></div>
      </div>
      <p class="note" data-at="7.4">أمثلة عامة على استخدامات الاتصالات الفضائية، وليست تأكيداً بأن جميع الخدمات متاحة عبر المحطة العراقية.</p>`
  },

  {
    id: 'national', label: 'البنية الرقمية الوطنية', layout: 'side',
    kicker: '٠٦ · القيمة الوطنية',
    title: 'المحطة الأرضية ضمن البنية التحتية الرقمية الوطنية',
    html: `
      <p class="idea idea-sm" data-at="0.8">تمثل المحطة الأرضية <b>بوابة للاتصالات الفضائية</b>، ويمكن أن تسهم في توسيع خيارات الاتصال وربط الشبكات الأرضية بالخدمات الفضائية، وفق الإمكانيات الفنية والخدمات المتاحة.</p>
      <ol class="axes4">
        <li data-at="2.4"><span class="ax-n">١</span><b>تنويع مسارات الاتصال</b><small>مسار فضائي مكمّل للشبكات الأرضية عند توافر الخدمة المناسبة.</small></li>
        <li data-at="3.8"><span class="ax-n">٢</span><b>دعم استمرارية الخدمات</b><small>إمكانية اتصال بديل لبعض المواقع وفق التصميم والتجهيزات.</small></li>
        <li data-at="5.2"><span class="ax-n">٣</span><b>ربط المواقع البعيدة</b><small>دعم اتصال المنشآت التي يصعب ربطها بالشبكات الأرضية.</small></li>
        <li data-at="6.6"><span class="ax-n">٤</span><b>بناء القدرات الوطنية</b><small>تطوير الخبرات في تشغيل الاتصالات الفضائية وإدارة خدماتها.</small></li>
      </ol>
      <p class="note" data-at="8.0">وجود المحطة لا يعني امتلاك قمر صناعي عراقي؛ والخدمات الفعلية تحددها التجهيزات والاتفاقات المتاحة.</p>`
  },


  {
    id: 'geo', label: 'المدارات والمحطة', layout: 'side',
    kicker: '٠٧ · المدارات والمحطة',
    title: 'من LEO إلى GEO: أين تعمل الأقمار الصناعية؟',
    html: `
      <ol class="orb-steps">
        <li data-at="1.0" data-step="0" class="os-leo"><span class="os-k"><b>LEO</b> المدار الأرضي المنخفض <i class="num">160–2,000 كم</i></span><small>قربه من الأرض يناسب كثيراً من تطبيقات التصوير والاستشعار عن بُعد، وتستخدمه بعض منظومات الاتصالات الحديثة.</small><span class="os-ex">رصد الأرض · اتصالات منخفضة المدار · علمية وبيئية</span></li>
        <li data-at="10.2" data-step="1" class="os-meo"><span class="os-k"><b>MEO</b> المدار الأرضي المتوسط <i class="num">2,000–35,786 كم</i></span><small>تُستخدم في منظومات الملاحة العالمية، ومنها <span class="latin">GPS</span> (نحو 20,200 كم)، لتحديد الموقع والتوقيت.</small></li>
        <li data-at="19.2" data-step="2" class="os-geo"><span class="os-k"><b>GEO</b> المدار الجغرافي الثابت <i class="num">≈ 35,786 كم · ≈ 24 ساعة</i></span><small>تغطية واسعة واتصال مستمر نسبياً بالمنطقة نفسها، مع تأخير أعلى (نحو ربع ثانية في الاتجاه الواحد).</small><span class="os-ex">اتصالات · بعض أقمار البث · بعض أقمار الأرصاد</span></li>
        <li data-at="28.2" data-step="3" class="os-st"><span class="os-k"><b>المحطة وأقمار GEO</b></span><small>المحطة الأرضية مصممة للتعامل مع أقمار محددة ضمن المدار الجغرافي الثابت <span class="latin">GEO</span>، وفق توافق الأنظمة والترددات والخدمات المتاحة.</small>
          <span class="os-legend"><em>المحطة: على سطح الأرض</em><em>القمر: جسم في المدار</em><em>المدار: مسار حركة القمر</em></span></li>
      </ol>
      <div class="orb-foot" data-at="30.0"><p>التوافق الفعلي يعتمد على تجهيزات المحطة والترددات والقمر والخدمة المتعاقد عليها. الرسم تخطيطي والأقمار مكبّرة.</p><button class="replay-in" type="button" data-replay>↻ إعادة الحركة</button></div>`
  },

  {
    id: 'history', label: 'من الدجيل إلى بغداد', layout: 'wide',
    kicker: '٠٨ · تطور الاتصالات الفضائية في العراق',
    title: 'من محطة الدجيل إلى Teleport بغداد: تطور الاتصالات الفضائية في العراق',
    html: `
      <div class="tl-wrap">
        <div class="tl-photos" data-at="1.0">
          <figure><img src="img/dujail-itig.jpg" alt="صورة منشورة مع مقال عن محطة الدجيل الأرضية"><figcaption><span class="real">صورة منشورة</span> مرفقة بمقال ITIG-IRAQ عن محطة الدجيل؛ لا يحدد المصدر مكان التصوير</figcaption></figure>
          <figure><img src="img/dish-real.jpg" alt="هوائي محطة Teleport بغداد" style="object-position: 50% 30%"><figcaption><span class="real">صورة حقيقية</span> هوائي محطة <span class="latin">Teleport</span> بغداد</figcaption></figure>
          <figure><img src="img/ceremony-stage.jpg" alt="منصة حفل افتتاح المحطة"><figcaption><span class="real">صورة حقيقية</span> حفل افتتاح محطة بغداد، تشرين الأول 2026</figcaption></figure>
        </div>
        <ol class="tl">
          <li data-at="1.8"><span class="tl-y num">1976</span><b>الدجيل-1 والدجيل-2</b><small>منظومة <span class="latin">INTELSAT</span> · هوائي قطره 32 م لكل محطة · اتصالات دولية</small><em class="tg-h">مصدر تاريخي</em></li>
          <li data-at="2.8"><span class="tl-y num">نحو 1980</span><b>الدجيل-3</b><small>ارتباط بمنظومة <span class="latin">Intersputnik</span></small><em class="tg-v">يحتاج تأكيداً</em></li>
          <li data-at="3.8"><span class="tl-y num">1991</span><b>أضرار الحرب</b><small>تضرر موقع الدجيل خلال حرب الخليج</small><em class="tg-h">مصدر تاريخي</em></li>
          <li data-at="4.8"><span class="tl-y num">2007</span><b>محطتان في النجف</b><small>هوائي 11 م للاتصالات الدولية، وآخر 16 م عبر <span class="latin">Nilesat</span></small><em class="tg-v">يحتاج تأكيداً رسمياً</em></li>
          <li data-at="5.8" class="tl-now"><span class="tl-y num">2026</span><b>محطة <span class="latin">Teleport</span> بغداد</b><small>افتُتحت في تشرين الأول 2026 · مخصصة لأقمار <span class="latin">GEO</span> بحسب التصريحات</small><em class="tg-h">معلن رسمياً</em></li>
        </ol>
      </div>
      <p class="keyline" data-at="7.6">خبرة عراقية في الاتصالات الفضائية تمتد لعقود؛ والمحطة الجديدة مرحلة حديثة في تطوير البنية الرقمية، لا امتداداً تقنياً مباشراً للمحطات السابقة.</p>`
  },

  {
    id: 'letter', label: 'كتاب وزارة الاتصالات', layout: 'doc',
    kicker: 'نقطة التحوّل',
    title: 'من الإمكانات التقنية إلى فرص التطبيق في قطاع النقل',
    html: `
      <div class="doc-head"><p class="kicker">نقطة التحوّل · كتاب وزارة الاتصالات – مكتب الوزير</p><h2>من الإمكانات التقنية إلى فرص التطبيق في قطاع النقل</h2></div>
      <div class="doc-stage" id="docStage">
        <div class="doc-page" id="docPage">
          <img src="img/letter-full.jpg" alt="كتاب وزارة الاتصالات – مكتب الوزير بعنوان: توفير خدمات الاتصالات الفضائية" draggable="false">
          <div class="doc-fx" id="docFx" aria-hidden="true"></div>
        </div>
      </div>
      <aside class="doc-sum ds" id="docSum" aria-live="polite">
        <div class="ds-card" id="dsCard"><div class="ds-top"><span id="dsK"></span><span id="dsN"></span></div><p id="dsT"></p><p id="dsE"></p></div>
      </aside>
      <p class="doc-keys" id="docKeys">K إيقاف أو متابعة القراءة · Shift + R إعادة المشهد</p>`
  },
  {
    id: 'transport', label: 'احتياجات التشكيلات', layout: 'side',
    kicker: '١٠ · التطبيقات المحتملة',
    title: 'التطبيقات المحتملة للاتصالات الفضائية في تشكيلات وزارة النقل العراقية',
    html: `
      <p class="lead">الهدف مناقشة الاحتياجات الفعلية لكل تشكيل، لا افتراض أن الجميع يحتاج الخدمة نفسها.</p>
      <div class="legend3"><span class="lg-pt">احتياج يُدرس</span><span class="lg-vf">خدمة تحتاج تأكيد توفرها</span></div>
      <div class="needs">
        <button class="need" data-goto="aviation"><b>الطيران والخطوط الجوية العراقية</b><span>هل توجد مواقع تشغيلية أو احتياجات اتصال يفيد فيها رابط فضائي أو مسار احتياطي؟</span></button>
        <button class="need" data-goto="ports"><b>الموانئ والنقل البحري</b><span>هل توجد مواقع بعيدة أو بحرية تحتاج إلى اتصال موثوق؟</span></button>
        <button class="need" data-goto="rail"><b>السكك الحديدية</b><span>هل توجد مواقع على امتداد الخطوط تفتقر إلى تغطية أرضية كافية؟</span></button>
        <button class="need" data-goto="devroad"><b>النقل البري وطريق التنمية</b><span>هل توجد مواقع تشغيلية بعيدة قد تحتاج إلى رابط اتصال احتياطي؟</span></button>
        <button class="need" data-goto="weather"><b>الأرصاد الجوية</b><span>هل توجد محطات رصد أو مواقع جمع بيانات بعيدة تحتاج إلى اتصال أكثر موثوقية؟</span></button>
      </div>`
  },
  {
    id: 'aviation', label: 'الطيران والمطارات', layout: 'side',
    kicker: '١١ · الطيران',
    title: 'الطيران والمطارات',
    html: `
      <div class="assess">
        <section class="as-b"><h4>الفائدة العملية المحتملة</h4><ul><li>مسار اتصال احتياطي لمواقع تشغيلية مختارة.</li><li>ربط مواقع بعيدة تفتقر إلى تغطية أرضية كافية.</li><li>اتصالات الطوارئ وفق تصميم الخدمة.</li></ul></section>
        <section class="as-c"><h4>الشروط اللازمة</h4><ul><li>ألّا يمسّ أنظمة الاتصالات والملاحة الجوية المعتمدة؛ فهو ليس بديلاً عنها.</li><li>موافقات الجهات التنظيمية للطيران والاتصالات.</li><li>معدات طرفية وتصميم شبكي مناسب.</li></ul></section>
        <section class="as-q"><h4>أسئلة تحتاج إلى تأكيد</h4><ul><li>ما المواقع التي تحتاج فعلاً إلى مسار احتياطي؟</li><li>هل يناسب زمن الاستجابة الاستخدام المقصود؟</li></ul></section>
      </div>
      <p class="note">الإنترنت على متن الطائرات خدمة مختلفة لها ترخيص مستقل (<span class="latin">AES</span>) ${SRC.cmc}، ولا تتوفر تلقائياً عبر المحطة.</p>`
  },
  {
    id: 'rail', label: 'السكك الحديدية', layout: 'side',
    kicker: '١٢ · السكك الحديدية',
    title: 'السكك الحديدية والنقل البري',
    html: `
      <div class="assess">
        <section class="as-b"><h4>الفائدة العملية المحتملة</h4><ul><li>اتصال في المواقع النائية على امتداد الخطوط والطرق.</li><li>ربط مواقع التشغيل والصيانة بمركز العمليات.</li><li>مسار احتياطي عند انقطاع الشبكات الأرضية.</li></ul></section>
        <section class="as-c"><h4>الشروط اللازمة</h4><ul><li>دراسة التغطية في المواقع الفعلية.</li><li>طرفيات فضائية مناسبة في كل موقع.</li><li>تكامل مع أنظمة التشغيل القائمة.</li></ul></section>
        <section class="as-q"><h4>أسئلة تحتاج إلى تأكيد</h4><ul><li>أين تضعف التغطية الأرضية فعلاً؟</li><li>ما حجم البيانات المطلوب نقله من كل موقع؟</li></ul></section>
      </div>`
  },
  {
    id: 'ports', label: 'الموانئ والنقل البحري', layout: 'side',
    kicker: '١٣ · الموانئ',
    title: 'الموانئ والنقل البحري',
    html: `
      <div class="assess">
        <section class="as-b"><h4>الفائدة العملية المحتملة</h4><ul><li>اتصال موثوق للمواقع الساحلية أو البعيدة.</li><li>دعم استمرارية الاتصالات في المواقع الملائمة.</li><li>مسار احتياطي في حالات الطوارئ.</li></ul></section>
        <section class="as-c"><h4>الشروط اللازمة</h4><ul><li>التمييز بين خدمات المحطة على اليابسة واتصال السفن في عرض البحر.</li><li>اتصال السفن يحتاج منظومة على السفينة وخدمة متوافقة وترخيصاً (<span class="latin">ESV</span>) ${SRC.cmc}.</li><li>تكامل مع أنظمة الموانئ القائمة.</li></ul></section>
        <section class="as-q"><h4>أسئلة تحتاج إلى تأكيد</h4><ul><li>ما المواقع الساحلية التي تحتاج إلى مسار إضافي؟</li><li>هل يدعم المشغّل الخدمة البحرية المطلوبة؟</li></ul></section>
      </div>
      <p class="context">سياق ذو صلة: افتتحت الهيأة البحرية العراقية العليا مشروع منظومة <span class="latin">VTS</span> لمراقبة حركة السفن ${SRC.mot}. دعم اتصال مواقع المراقبة الساحلية أحد مجالات التقييم الممكنة.</p>
      <p class="note">المسار الضوئي في المجسّم يوضح إمكانية ربط موقع ساحلي أو توفير اتصال احتياطي، ولا يعني تشغيل الرافعات أو تتبع السفن عبر المحطة.</p>`
  },
  {
    id: 'weather', label: 'الأرصاد والإنذار المبكر', layout: 'side',
    kicker: '١٤ · الأنواء الجوية',
    title: 'الأرصاد الجوية والإنذار المبكر: ثلاثة محاور',
    html: `
      <ol class="wx3">
        <li data-at="1.4" data-step="0"><span class="wx-h"><b>١ · محطات أرضية</b><em class="tg-pot">تطبيق محتمل</em></span>
          <small>ربط محطات الأرصاد البعيدة ونقل قراءاتها إلى مركز المعالجة والمتابعة.</small>
          <span class="wx-chips"><i>الحرارة</i><i>الرطوبة</i><i>الضغط الجوي</i><i>الرياح</i><i>الأمطار</i></span>
          <span class="wx-n">يحتاج محطات قياس وأجهزة اتصال وشبكة؛ القمر الصناعي ليس بديلاً عن أجهزة القياس الأرضية.</span></li>
        <li data-at="9.8" data-step="1"><span class="wx-h"><b>٢ · بيانات الأقمار الجوية</b><em class="tg-pot">فرصة للتطوير</em></span>
          <small>الاستفادة من بيانات وصور الأقمار الجوية لمراقبة السحب والعواصف والتغيرات الجوية، وفق مصادر البيانات وأنظمة الاستقبال المتاحة.</small>
          <span class="wx-warn">استقبال صور الأرصاد يتطلب مصدراً مناسباً للبيانات وتجهيزات وبرمجيات متوافقة؛ ووجود محطة اتصالات <span class="latin">GEO</span> لا يعني أن هذه الوظيفة متاحة تلقائياً.</span></li>
        <li data-at="18.0" data-step="2"><span class="wx-h"><b>٣ · الإنذار المبكر وإدارة الكوارث</b><em class="tg-pot">تطبيق محتمل</em></span>
          <span class="wx-chain"><i>رصد الظاهرة</i><i>جمع البيانات</i><i>التحليل</i><i>إصدار التنبيه</i><i>دعم القرار</i></span>
          <small>العواصف · الفيضانات والأمطار الغزيرة · الغبار والعواصف الترابية · تبادل المعلومات أثناء الطوارئ.</small>
          <span class="wx-n">منظومة تكاملية تحتاج بيانات موثوقة وأجهزة استشعار وبرمجيات تحليل وتنسيقاً بين الجهات؛ وليست خدمة تنتجها المحطة الأرضية وحدها.</span></li>
      </ol>
      <p class="note" data-at="20.5">المواقع والسحب ومناطق التنبيه في المجسّم محاكاة توضيحية، ولا تمثل منظومة عاملة حالياً.</p>`
  },

  {
    id: 'devroad', label: 'طريق التنمية', layout: 'side',
    kicker: '١٥ · طريق التنمية',
    title: 'طريق التنمية: مشروع ممتد يحتاج اتصالاً وبيانات',
    html: `
      <div class="dr-facts" data-at="1.0">
        <p>من <b>ميناء الفاو الكبير</b> في البصرة إلى <b>فيشخابور</b> على الحدود العراقية التركية: طريق سريع بطول <b class="num">1,190 كم</b> وسكة حديد مزدوجة بطول نحو <b class="num">1,175 كم</b>. المسار على الخريطة توضيحي.</p>
      </div>
      <ul class="nat-points">
        <li data-at="4.0"><b>متابعة المواقع الممتدة</b><span>مواقع بنية تحتية ومناطق بعيدة على امتداد المسار.</span></li>
        <li data-at="5.4"><b>الاتصال حيث تضعف التغطية</b><span>تبادل البيانات عبر مسار فضائي مناسب، إذا كانت الخدمة متاحة.</span></li>
        <li data-at="6.8"><b>الاستشعار عن بُعد والتحليل الجغرافي</b><span>متابعة التغيرات في مواقع المشروع من مصادر بيانات مناسبة، وهي غير خدمات الاتصالات.</span></li>
      </ul>
      <p class="note" data-at="8.2">فرص متكاملة محتملة، لا خدمات مؤكدة. لا يوجد ما يثبت ارتباط المحطة الحالية بمشروع طريق التنمية.</p>`
  },
  {
    id: 'security', label: 'الأمن والتشغيل', layout: 'wide',
    kicker: '١٦ · الأمن والتشغيل',
    title: 'الأمن والتشغيل والحوكمة',
    html: `
      <div class="cts">
        <div class="cts-ico" aria-hidden="true"></div>
        <div><small>أُعلن عند الإطلاق</small><b>جهاز مكافحة الإرهاب: أول جهة تعاقدت على خدمات المحطة</b><span>بسعة 10 ميغاهيرتز قابلة للتوسع.</span></div>
        <span class="lg-tag lg-vf">طبيعة العقد ونطاقه وأطرافه تتطلب التأكيد</span>
      </div>
      <p class="fact">ورد «جهاز مكافحة الارهاب» ضمن الجهات المرسَل إليها نسخة من كتاب وزارة الاتصالات «للتفضل بالاطلاع ... ولنفس الغرض المذكور في الاعلى» ${SRC.moc}</p>
      <div class="sec-grid">
        <section><h4>الأدوار</h4>
          <ul><li><b>المالك والمشغّل</b> وزارة الاتصالات وشركتها العامة، بحسب ما يحدده العقد</li><li><b>مزوّد التقنية</b> شركة <span class="latin">Commercis</span> ${SRC.inv}</li><li><b>الجهة التنظيمية</b> هيأة الإعلام والاتصالات ${SRC.cmc}</li><li><b>الجهات المستفيدة</b> الدوائر عبر الشركة العامة للاتصالات والمعلوماتية ${SRC.moc}</li></ul></section>
        <section><h4>متطلبات مقترحة لأي استخدام</h4>
          <ul class="checks"><li>تقييم أمن سيبراني مستقل</li><li>صلاحيات مسمّاة بأقل امتياز</li><li>تشفير مع بقاء المفاتيح لدى الجهة</li><li>دعم عن بُعد مسجَّل وبموافقة مسبقة</li><li>تدقيق دوري وسجلات محفوظة</li><li>مسار بديل وخطة تعافٍ</li></ul></section>
      </div>
      <p class="fact">تنص ${SRC.cmc} على أن أي وصول إلى الشبكة لغرض اعتراض المعلومات يكون وفق أوامر قضائية.</p>`
  },
  {
    id: 'roadmap', label: 'خطة العمل', layout: 'wide',
    kicker: '١٧ · الخطوة التالية',
    title: 'من الفكرة إلى خطة العمل',
    html: `
      <ol class="proc3">
        <li data-at="0.8"><span class="pn">١</span><b>حصر الاحتياجات</b><small>تحديد الاحتياجات التشغيلية الفعلية في تشكيلات الوزارة.</small></li>
        <li data-at="2.6"><span class="pn">٢</span><b>التحقق من الإمكانات الفنية والتشغيلية</b><small>الأقمار المدعومة، والتغطية، والسعة، والتجهيزات، والكلفة، والتراخيص، وشروط الخدمة.</small></li>
        <li data-at="4.4"><span class="pn">٣</span><b>ترتيب الأولويات</b><small>وفق القيمة التشغيلية، والجدوى، والكلفة، والجاهزية.</small></li>
      </ol>
      <div class="ask" data-at="6.4"><small>للنقاش</small><b>ما التطبيقات التي ترون أنها تمثل أولوية لتشكيلات وزارة النقل، وما المتطلبات اللازمة لدراسة إمكانية تنفيذها؟</b></div>`
  },
  {
    id: 'thanks', label: 'الختام', layout: 'hero',
    html: `
      <div class="finale">
        <div class="emblem" aria-hidden="true">
          <div class="logo-card" data-logo-large></div>
        </div>
        <h1 class="finale-title">شكراً لحسن استماعكم</h1>
        <p class="finale-sub">نرحّب بآرائكم وملاحظاتكم ومقترحاتكم</p>
        <p class="finale-motto">معاً نحو توظيف التقنيات الحديثة لخدمة قطاعات النقل في العراق</p>
        <p class="finale-credit"><span class="cr-k">إعداد</span> المهندسة غادة هاشم</p>
        <p class="finale-org">وزارة النقل العراقية <span>·</span> <span class="latin">Iraq Space Connectivity × Transportation</span></p>
      </div>`
  },
];
