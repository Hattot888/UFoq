/**
 * HORIZON CONTEMPORARY ART GALLERY (معرض أفق للفنون المعاصرة)
 * Application Configuration
 *
 * IMPORTANT INSTRUCTIONS FOR DEVELOPER / STORE OWNER:
 * 1. Create a free project at https://supabase.com
 * 2. Run the SQL schema from `supabase/schema.sql` in Supabase SQL Editor.
 * 3. Run the seed data from `supabase/seed.sql` to insert sample artworks.
 * 4. Copy your Project URL and Publishable Anon Key from:
 *    Project Settings -> API -> Project URL & Project API Keys (anon public)
 * 5. Paste them below into SUPABASE_URL and SUPABASE_ANON_KEY.
 *
 * SECURITY NOTE:
 * Only use the public 'anon' key here.
 * NEVER place your 'service_role' secret key or database password in this file!
 */

export const CONFIG = {
  // Store identity
  STORE_NAME: 'معرض أفق للفنون',
  STORE_NAME_EN: 'HORIZON Contemporary Art Gallery',
  STORE_TAGLINE: 'لوحات فنية أصلية معاصرة تروي حكاية الجمال والأصالة',
  CURRENCY: 'EGP',
  CURRENCY_SYMBOL: 'ج.م',
  DEFAULT_LOCALE: 'ar-EG',

  // Supabase Credentials
  // Replace these placeholders with your actual Supabase project credentials:
  SUPABASE_URL: 'https://iifynkzkbkysdzgddpod.supabase.co', // e.g. 'https://xyzcompany.supabase.co'
  SUPABASE_ANON_KEY: 'sb_publishable_T0tKqhIO6N1aa_Dr325ssw_ccomJGJA', // e.g. 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

  // Analytics Settings
  ANALYTICS: {
    ENABLED: true,
    DEBUG_LOGS: true, // Output tracking events to console in development
    TRACK_SITE_VISIT_ONCE_PER_SESSION: true,
    RESPECT_DO_NOT_TRACK: true, // Honor browser Do-Not-Track header
  },

  // Fallback / Offline Demo Catalog
  // Allows the gallery UI to be viewed and tested locally before Supabase is connected
  FALLBACK_CATALOG: [
    {
      id: 'a1b2c3d4-e5f6-4a1b-8c2d-111111111111',
      name: 'صدى الصحراء الذهبية',
      slug: 'desert-golden-echo',
      description: 'لوحة تجريدية معاصرة تستحضر تموجات الكثبان الرملية وانعكاسات ضوء الغروب الدافئ، مرسومة بطبقات متعددة من المعجون والصبغات المعدنية لمنح العمل عمقاً وتأثيراً بصرياً ملموساً.',
      price: 14500.00,
      currency: 'EGP',
      image_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
      category: 'تجريدي',
      artist: 'عمر الشريف',
      dimensions: '120 × 90 سم',
      medium: 'ألوان زيتية وأكريليك مع رقائق ذهبية على كانفاس',
      stock_quantity: 2,
      is_active: true
    },
    {
      id: 'a1b2c3d4-e5f6-4a1b-8c2d-222222222222',
      name: 'تناغم النيل عند الشفق',
      slug: 'nile-twilight-harmony',
      description: 'مشهد انطباعي يعكس سكون ضفاف النيل في لحظات الشفق الساحرة، حيث تتمازج درجات الأزرق الملكي والنيلي مع لمسات الأرجواني الخافتة في حركة انسيابية رقيقة.',
      price: 18200.00,
      currency: 'EGP',
      image_url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1200&q=80',
      category: 'انطباعي',
      artist: 'نادين منصور',
      dimensions: '150 × 100 سم',
      medium: 'زيت على قماش كتان بلجيكي',
      stock_quantity: 1,
      is_active: true
    },
    {
      id: 'a1b2c3d4-e5f6-4a1b-8c2d-333333333333',
      name: 'همس الحروف والضوء',
      slug: 'whisper-of-letters',
      description: 'عمل يجمع بين أصالة فن الخط العربي والتشكيل الحداثي المفتوح، حيث تتداخل الحروف المنطلقة مع مساحات تنفس بيضاء تحاكي الضوء والروحانية الشرقية.',
      price: 12800.00,
      currency: 'EGP',
      image_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
      category: 'خط عربي معاصر',
      artist: 'طارق السعيد',
      dimensions: '100 × 100 سم',
      medium: 'حبر ياباني ومواد مختلطة على خشب السنديان',
      stock_quantity: 3,
      is_active: true
    },
    {
      id: 'a1b2c3d4-e5f6-4a1b-8c2d-444444444444',
      name: 'سكون الرمان والخزف',
      slug: 'still-life-pomegranate',
      description: 'تكوين طبيعة صامتة كلاسيكي بروح معاصرة، يبرز التباين بين قشرة الرمان المشبعة بالحمرة وأواني الخزف اليدوي العتيقة، مع دراسة دقيقة لتدرجات الظل والنور.',
      price: 9500.00,
      currency: 'EGP',
      image_url: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=1200&q=80',
      category: 'طبيعة صامتة',
      artist: 'مريم الجندي',
      dimensions: '80 × 60 سم',
      medium: 'ألوان زيتية تقليدية على لوح خشبي مجهز',
      stock_quantity: 1,
      is_active: true
    },
    {
      id: 'a1b2c3d4-e5f6-4a1b-8c2d-555555555555',
      name: 'واحة السكينة الغامضة',
      slug: 'tranquil-oasis',
      description: 'منظر طبيعي شاعري مستوحى من واحة سيوة المصرية، يستكشف العلاقة الأزلية بين ظلال النخيل الباسقة وعين الماء العذبة تحت سماء صافية تفيض بالهدوء.',
      price: 16000.00,
      currency: 'EGP',
      image_url: 'https://images.unsplash.com/photo-1582561424760-0321d75e81fa?auto=format&fit=crop&w=1200&q=80',
      category: 'مناظر طبيعية',
      artist: 'كريم عبد العزيز',
      dimensions: '130 × 95 سم',
      medium: 'أكريليك بأسلوب السكين على كانفاس مشدود',
      stock_quantity: 2,
      is_active: true
    },
    {
      id: 'a1b2c3d4-e5f6-4a1b-8c2d-666666666666',
      name: 'إيقاع المدينة العتيقة',
      slug: 'ancient-city-rhythm',
      description: 'تجسيد بصري درامي لأزقة القاهرة التاريخية القديمة بحركتها الدائبة وتدرجات حجرها المعتق، مع تباين قوي بين الإضاءة الصباحية والظلال الغائرة.',
      price: 21500.00,
      currency: 'EGP',
      image_url: 'https://images.unsplash.com/photo-1579783901586-7880cb4cd700?auto=format&fit=crop&w=1200&q=80',
      category: 'تعبيري',
      artist: 'د. يوسف الحكيم',
      dimensions: '160 × 110 سم',
      medium: 'ألوان زيتية متعددة الطبقات Glazing على كانفاس',
      stock_quantity: 1,
      is_active: true
    },
    {
      id: 'a1b2c3d4-e5f6-4a1b-8c2d-777777777777',
      name: 'تأملات في الفيروز',
      slug: 'turquoise-meditations',
      description: 'لوحة تجريدية هندسية ومينيمالية تحتفي بدرجات الفيروز النقي والأزرق السماوي المستوحى من مياه البحر الأحمر، مانحة المكان شعوراً فورياً بالاتساع والنقاء.',
      price: 11000.00,
      currency: 'EGP',
      image_url: 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=1200&q=80',
      category: 'تجريدي',
      artist: 'ليلى فخري',
      dimensions: '100 × 70 سم',
      medium: 'أصباغ طبيعية وأكريليك على قماش قطني معالج',
      stock_quantity: 2,
      is_active: true
    },
    {
      id: 'a1b2c3d4-e5f6-4a1b-8c2d-888888888888',
      name: 'حوار الأرض والمطر',
      slug: 'earth-and-rain-dialogue',
      description: 'لوحة تعبيرية تستعرض ملمس الطين الرطب وقطرات المطر الأولى، بألوان ترابية غنية تشمل المغرة المحروقة والرمادي الدافئ مع لمسات خضراء تنبئ بالحياة.',
      price: 13400.00,
      currency: 'EGP',
      image_url: 'https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?auto=format&fit=crop&w=1200&q=80',
      category: 'تعبيري',
      artist: 'أحمد بدر الدين',
      dimensions: '110 × 85 سم',
      medium: 'ألوان مائية وزيتية وتقنيات خلط وسائط على قماش',
      stock_quantity: 1,
      is_active: true
    }
  ]
};

/**
 * Checks whether Supabase credentials have been configured.
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return Boolean(
    CONFIG.SUPABASE_URL &&
    CONFIG.SUPABASE_ANON_KEY &&
    CONFIG.SUPABASE_URL.startsWith('https://') &&
    !CONFIG.SUPABASE_URL.includes('your-project') &&
    CONFIG.SUPABASE_ANON_KEY.length > 20
  );
}
