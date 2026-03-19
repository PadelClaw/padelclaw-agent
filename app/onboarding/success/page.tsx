import OnboardingSuccessClient from './success-client'

export default async function OnboardingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ trainerId?: string }>
}) {
  const params = await searchParams

  return <OnboardingSuccessClient trainerId={params.trainerId ?? null} />
}
