-- SQL FIX FOR LOCATION TRACKING (SAFER VERSION)
-- Run this in Supabase SQL Editor

-- 1. Đảm bảo bảng locations tồn tại
CREATE TABLE IF NOT EXISTS public.locations (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Kích hoạt Realtime (Cách an toàn)
DO $$
BEGIN
    -- Kiểm tra publication existence
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    
    -- Kiểm tra xem bảng đã có trong publication chưa trước khi thêm
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'locations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
    END IF;
END $$;

-- Đặt replica identity để nhận toàn bộ payload
ALTER TABLE public.locations REPLICA IDENTITY FULL;

-- 3. Cấu hình Row Level Security (RLS)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can see locations" ON public.locations;
DROP POLICY IF EXISTS "Users can upsert own location" ON public.locations;

CREATE POLICY "Anyone can see locations" 
ON public.locations FOR SELECT 
USING (true);

CREATE POLICY "Users can upsert own location" 
ON public.locations FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Bổ sung quyền cho profiles (để hiện avatar trên map)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

