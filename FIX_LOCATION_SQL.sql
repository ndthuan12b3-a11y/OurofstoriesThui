-- CHỈNH SỬA TOÀN DIỆN HỆ THỐNG (BẢN FINAL SẠCH SẼ)
-- Vui lòng copy và chạy toàn bộ mã này trong Supabase SQL Editor

-- 1. Chuẩn hóa bảng profiles (Lưu thông tin người dùng & Avatar)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Chuẩn hóa bảng locations (Lưu vị trí Trực tuyến)
-- Xóa bảng cũ nếu bị lỗi cấu trúc PK/Unique phức tạp
-- DROP TABLE IF EXISTS public.locations CASCADE; 

CREATE TABLE IF NOT EXISTS public.locations (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT locations_user_id_unique UNIQUE (user_id)
);

-- 3. Cấu hình Realtime (Để 2 người thấy nhau ngay lập tức)
DO $$
BEGIN
    -- Tạo Publication nếu chưa có
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    
    -- Thêm bảng locations vào Realtime
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'locations') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
    END IF;

    -- Thêm bảng profiles vào Realtime
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
END $$;

-- Nhận đầy đủ dữ liệu khi có thay đổi
ALTER TABLE public.locations REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- 4. Chính sách bảo mật (RLS)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Xóa chính sách cũ để làm mới
DROP POLICY IF EXISTS "Anyone can see locations" ON public.locations;
DROP POLICY IF EXISTS "Users can upsert own location" ON public.locations;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Locations: Công khai cho đối phương xem, chỉ chủ sở hữu mới cập nhật được
CREATE POLICY "Anyone can see locations" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Users can upsert own location" ON public.locations FOR ALL USING (auth.uid() = user_id);

-- Profiles: Công khai cho đối phương xem, chỉ chủ sở hữu mới cập nhật được
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id OR auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() = user_id);
