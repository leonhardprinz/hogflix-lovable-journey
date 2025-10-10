-- Allow users to update their own subscriptions
CREATE POLICY "Users can update their own subscription"
ON public.user_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);