
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'recruiter');
CREATE TYPE public.job_status AS ENUM ('open', 'closed');
CREATE TYPE public.application_stage AS ENUM ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected');

-- Companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1 $$;

-- Jobs table
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status job_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Candidates table
CREATE TABLE public.candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  resume_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Applications table
CREATE TABLE public.applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  stage application_stage NOT NULL DEFAULT 'applied',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Notes table
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Companies
CREATE POLICY "Users can view own company" ON public.companies FOR SELECT TO authenticated USING (id = public.get_user_company_id(auth.uid()));

-- RLS: Profiles
CREATE POLICY "Users can view profiles in own company" ON public.profiles FOR SELECT TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- RLS: User Roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- RLS: Jobs
CREATE POLICY "Users can view jobs" ON public.jobs FOR SELECT TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can create jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update jobs" ON public.jobs FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admins can delete jobs" ON public.jobs FOR DELETE TO authenticated USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- RLS: Candidates
CREATE POLICY "Users can view candidates" ON public.candidates FOR SELECT TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can create candidates" ON public.candidates FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update candidates" ON public.candidates FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admins can delete candidates" ON public.candidates FOR DELETE TO authenticated USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- RLS: Applications
CREATE POLICY "Users can view applications" ON public.applications FOR SELECT TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can create applications" ON public.applications FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update applications" ON public.applications FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admins can delete applications" ON public.applications FOR DELETE TO authenticated USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- RLS: Notes
CREATE POLICY "Users can view notes" ON public.notes FOR SELECT TO authenticated USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can create notes" ON public.notes FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Users can update own notes" ON public.notes FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own notes" ON public.notes FOR DELETE TO authenticated USING (user_id = auth.uid());
