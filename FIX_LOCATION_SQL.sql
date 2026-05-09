-- CHỈNH SỬA TOÀN DIỆN HỆ THỐNG (BẢN FIX FOREIGN KEY)
-- Chạy mã này trong Supabase SQL Editor

-- 1. Bảng profiles (Đảm bảo ID là chính khóa và liên kết auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fix: Nếu bảng đã tồn tại nhưng id không phải là PK hoặc thiếu cột
DO $$ 
BEGIN 
    -- Đảm bảo có cột user_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_id') THEN
        ALTER TABLE public.profiles ADD COLUMN user_id UUID UNIQUE REFERENCES auth.users(id);
    END IF;
    
    -- Đảm bảo user_id là UNIQUE để dùng được UPSERT onConflict
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_user_id_key' 
    ) THEN
        BEGIN
            ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Không thể tạo unique constraint cho user_id. Có thể nó đã tồn tại dưới tên khác.';
        END;
    END IF;
END $$;

-- 2. Bảng locations (Lưu vị trí)
CREATE TABLE IF NOT EXISTS public.locations (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT locations_user_id_unique UNIQUE (user_id)
);

-- 3. Kích hoạt Realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    
    -- Thêm các bảng vào realtime
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'locations') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
END $$;

ALTER TABLE public.locations REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- 4. Cấu hình RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Xóa các chính sách cũ
DROP POLICY IF EXISTS "Anyone can see locations" ON public.locations;
DROP POLICY IF EXISTS "Users can upsert own location" ON public.locations;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Thiết lập chính sách mới
CREATE POLICY "Anyone can see locations" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Users can upsert own location" ON public.locations FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id OR auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() = user_id);
