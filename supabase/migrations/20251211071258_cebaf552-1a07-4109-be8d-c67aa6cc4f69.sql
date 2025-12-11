-- Create role enum
CREATE TYPE public.shop_role AS ENUM ('owner', 'employee');

-- Create shops table
CREATE TABLE public.shops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shop_members table (links users to shops with roles)
CREATE TABLE public.shop_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role shop_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shop_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role in a shop
CREATE OR REPLACE FUNCTION public.get_user_shop_role(p_user_id UUID, p_shop_id UUID)
RETURNS shop_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.shop_members
  WHERE user_id = p_user_id AND shop_id = p_shop_id
  LIMIT 1
$$;

-- Security definer function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_shop_owner(p_user_id UUID, p_shop_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE user_id = p_user_id AND shop_id = p_shop_id AND role = 'owner'
  )
$$;

-- Security definer function to get user's shop
CREATE OR REPLACE FUNCTION public.get_user_shop_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id FROM public.shop_members
  WHERE user_id = p_user_id
  LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Shops policies
CREATE POLICY "Members can view their shop"
ON public.shops FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE shop_members.shop_id = shops.id
    AND shop_members.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can update their shop"
ON public.shops FOR UPDATE
USING (public.is_shop_owner(auth.uid(), id));

CREATE POLICY "Authenticated users can create shops"
ON public.shops FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Shop members policies
CREATE POLICY "Members can view shop members"
ON public.shop_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shop_members sm
    WHERE sm.shop_id = shop_members.shop_id
    AND sm.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can insert shop members"
ON public.shop_members FOR INSERT
WITH CHECK (
  public.is_shop_owner(auth.uid(), shop_id)
  OR NOT EXISTS (SELECT 1 FROM public.shop_members WHERE shop_id = shop_members.shop_id)
);

CREATE POLICY "Owners can delete shop members"
ON public.shop_members FOR DELETE
USING (public.is_shop_owner(auth.uid(), shop_id));

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();