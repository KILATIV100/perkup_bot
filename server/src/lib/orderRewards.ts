import { Prisma } from '@prisma/client'
import { calcEarnedPoints } from './loyalty'

export function getOrderRewardKey(orderId: number): string {
  return `order-complete-${orderId}`
}

export async function awardCompletedOrderLoyalty(
  tx: Prisma.TransactionClient,
  input: { orderId: number; userId: number; total: number; userPoints: number }
) {
  const pointsEarned = calcEarnedPoints(input.total, input.userPoints)

  try {
    await tx.pointsTransaction.create({
      data: {
        userId: input.userId,
        amount: pointsEarned,
        type: 'ORDER',
        description: `Бали за замовлення #${input.orderId}`,
        idempotencyKey: getOrderRewardKey(input.orderId),
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return 0
    }
    throw error
  }

  await tx.user.update({
    where: { id: input.userId },
    data: {
      points: { increment: pointsEarned },
      monthlyOrders: { increment: 1 },
    },
  })

  return pointsEarned
}
