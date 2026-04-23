-- Allow admins in the same company to delete screening submissions
CREATE POLICY "Admins can delete submissions"
ON public.screening_submissions
FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::public.app_role));