import { prisma } from "@/lib/prisma";
import { PLANS, type PlanKey } from "@/lib/stripe";

export async function getUserSubscriptionPlan(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stripeSubscriptionId: true,
      stripeCurrentPeriodEnd: true,
      stripeCustomerId: true,
      stripePriceId: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const isSubscribed =
    user.stripePriceId &&
    user.stripeCurrentPeriodEnd &&
    user.stripeCurrentPeriodEnd.getTime() + 86_400_000 > Date.now();

  let currentPlan: PlanKey = "free";
  if (isSubscribed && user.stripePriceId) {
    for (const [key, plan] of Object.entries(PLANS)) {
      if (
        plan.stripePriceId.monthly === user.stripePriceId ||
        plan.stripePriceId.yearly === user.stripePriceId
      ) {
        currentPlan = key as PlanKey;
        break;
      }
    }
  }

  const plan = PLANS[currentPlan];

  return {
    ...plan,
    ...user,
    planKey: currentPlan,
    isSubscribed: !!isSubscribed,
  };
}
