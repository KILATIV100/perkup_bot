import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { awardCompletedOrderLoyalty } from '../../lib/orderRewards'
import { calcEarnedPoints, getLevel } from '../../lib/loyalty'
import { normalizePhone } from '../../lib/phone'

const BOT = process.env.BOT_TOKEN || ''

async function tgSend(chatId: string, text: string) {
  if (!BOT) return
  try {
    await fetch('https://api.telegram.org/bot' + BOT + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch (e) { console.error('tgSend:', e) }
}

const SEP = '\u2500'.repeat(28)
const EM: Record<string, string> = {
  Bronze: '\ud83e\udd49',
  Silver: '\ud83e\udd48',
  Gold: '\ud83e\udd47',
  Platinum: '\ud83d\udc8e',
}

function buildReceipt(orderId: number, locationName: string, itemLines: string, total: number, pts: number, bal: number, level: string): string {
  const lvlEmoji = EM[level] || '\u2615'
  return [
    '\ud83e\uddfe *\u0427\u0435\u043a #' + orderId + '*',
    SEP,
    '\ud83d\udccd ' + locationName,
    SEP,
    itemLines,
    SEP,
    '\ud83d\udcb3 *\u0420\u0430\u0437\u043e\u043c: ' + Math.round(total) + ' \u0433\u0440\u043d*',
    SEP,
    lvlEmoji + ' *+' + pts + ' \u0431\u0430\u043b\u0456\u0432 \u043d\u0430\u0440\u0430\u0445\u043e\u0432\u0430\u043d\u043e*',
    '   \u0411\u0430\u043b\u0430\u043d\u0441: ' + bal + ' \u0431\u0430\u043b\u0456\u0432',
    SEP,
    '_\u0414\u044f\u043a\u0443\u0454\u043c\u043e! \u041f\u0440\u0438\u0445\u043e\u0434\u044c\u0442\u0435 \u0437\u043d\u043e\u0432\u0443 \u2615_',
  ].join('\n')
}

async function findUserByPosterTransaction(subdomain: string, token: string, transactionId: number, log: any): Promise<{ userId: number; telegramId: bigint | null } | null> {
  try {
    const url = 'https://' + subdomain + '.joinposter.com/api/transactions.getTransactionById?token=' + token + '&transaction_id=' + transactionId
    const res = await fetch(url)
    const data = await res.json() as any
    log.info({ transactionId, keys: Object.keys(data?.response || {}) }, 'Poster transaction keys')

    const phone = data?.response?.client_phone || data?.response?.phone
    if (phone) {
      const normalized = normalizePhone(String(phone))
      const user = await prisma.user.findFirst({ where: { phone: normalized } })
      if (user) { log.info({ userId: user.id }, 'Found user by phone'); return { userId: user.id, telegramId: user.telegramId } }
    }

    const clientId = data?.response?.client_id
    if (clientId) {
      const clientUrl = 'https://' + subdomain + '.joinposter.com/api/clients.getClient?token=' + token + '&client_id=' + clientId
      const clientRes = await fetch(clientUrl)
      const clientData = await clientRes.json() as any
      const clientPhone = clientData?.response?.phone
      if (clientPhone) {
        const normalized = normalizePhone(String(clientPhone))
        const user = await prisma.user.findFirst({ where: { phone: normalized } })
        if (user) { log.info({ userId: user.id }, 'Found user by Poster client phone'); return { userId: user.id, telegramId: user.telegramId } }
      }
    }

    log.info({ transactionId }, 'No PerkUp user found for this Poster transaction')
    return null
  } catch (e) {
    log.error({ err: String(e) }, 'findUserByPosterTransaction error')
    return null
  }
}

async function awardOfflinePoints(userId: number, totalGrn: number, transactionId: number, locationName: string, log: any): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return 0

  const key = 'poster-offline-' + transactionId
  const existing = await prisma.pointsTransaction.findFirst({ where: { idempotencyKey: key } })
  if (existing) { log.info({ transactionId }, 'Offline points already awarded'); return 0 }

  const pts = calcEarnedPoints(totalGrn, user.points)
  if (pts <= 0) return 0

  await prisma.$transaction(async (tx: any) => {
    await tx.pointsTransaction.create({
      data: {
        userId,
        amount: pts,
        type: 'ORDER',
        description: 'Baly za oflayn zamovlennya v ' + locationName + ' (Poster #' + transactionId + ')',
        idempotencyKey: key,
      },
    })
    await tx.user.update({
      where: { id: userId },
      data: { points: { increment: pts }, monthlyOrders: { increment: 1 } },
    })
  })

  log.info({ userId, pts, transactionId }, 'Offline points awarded')
  return pts
}

async function completeOnlineOrder(order: any, locationName: string, log: any) {
  if (order.status === 'COMPLETED') { log.info({ orderId: order.id }, 'Already completed'); return }

  try {
    const pts = await prisma.$transaction((tx: any) => awardCompletedOrderLoyalty(tx, {
      orderId: order.id,
      userId: order.userId,
      total: Number(order.total),
      userPoints: order.user.points,
    }))

    await prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } })

    const updated = await prisma.user.findUnique({ where: { id: order.userId } })
    const bal = updated?.points || 0
    const lvl = getLevel(bal)

    let itemLines = ''
    for (const item of order.items) {
      const name = item.product?.name || item.bundle?.name || 'Item'
      const price = Math.round(Number(item.price || 0))
      itemLines += '  ' + name + ' x' + item.quantity + '  ' + (price * item.quantity) + ' grn\n'
    }

    const text = buildReceipt(order.id, locationName, itemLines.trim(), Number(order.total), pts, bal, lvl)
    await tgSend(String(order.user.telegramId), text)
    log.info({ orderId: order.id, pts, bal }, 'Online order COMPLETED + receipt sent')
  } catch (e) {
    log.error({ err: String(e), orderId: order.id }, 'completeOnlineOrder error')
  }
}

export default async function posterWebhookRoutes(app: FastifyInstance) {

  app.post('/', async (req, reply) => {
    reply.send({ success: true })

    const p = req.body as any
    app.log.info({ object: p.object, action: p.action, object_id: p.object_id, account: p.account }, 'Poster webhook received')

    if (!p.account || !p.object_id) return

    const location = await prisma.location.findFirst({
      where: { posterSubdomain: p.account, hasPoster: true },
    })
    if (!location) { app.log.warn({ account: p.account }, 'Location not found'); return }

    // TRANSACTION CLOSED = paid
    if (p.object === 'transaction' && p.action === 'closed') {
      app.log.info({ transactionId: p.object_id }, 'Transaction CLOSED = PAID')

      // First: check for online order
      const onlineOrder = await prisma.order.findFirst({
        where: {
          locationId: location.id,
          status: { in: ['SENT_TO_POS', 'ACCEPTED', 'PREPARING', 'READY'] },
        },
        include: {
          user: true,
          items: { include: { product: { select: { name: true } }, bundle: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (onlineOrder) {
        await completeOnlineOrder(onlineOrder, location.name, app.log)
        return
      }

      // No online order: offline Poster client
      if (!location.posterToken) { app.log.warn({ slug: location.slug }, 'No posterToken'); return }

      app.log.info({ transactionId: p.object_id }, 'No online order - checking offline Poster client')

      try {
        const txUrl = 'https://' + p.account + '.joinposter.com/api/transactions.getTransactionById?token=' + location.posterToken + '&transaction_id=' + p.object_id
        const txRes = await fetch(txUrl)
        const txData = await txRes.json() as any
        const totalKopecks = Number(txData?.response?.sum || txData?.response?.total_sum || 0)
        const totalGrn = totalKopecks / 100
        app.log.info({ totalGrn, transactionId: p.object_id }, 'Offline transaction total')

        if (totalGrn <= 0) { app.log.info({}, 'No total in offline transaction'); return }

        const userInfo = await findUserByPosterTransaction(p.account, location.posterToken, Number(p.object_id), app.log)
        if (!userInfo) return

        const pts = await awardOfflinePoints(userInfo.userId, totalGrn, Number(p.object_id), location.name, app.log)
        if (pts <= 0) return

        const updated = await prisma.user.findUnique({ where: { id: userInfo.userId } })
        const bal = updated?.points || 0
        const lvl = getLevel(bal)
        const lvlEmoji = EM[lvl] || '\u2615'

        const text = [
          '\ud83e\uddfe *Oflayn zamovlennya*',
          SEP,
          '\ud83d\udccd ' + location.name,
          SEP,
          '\ud83d\udcb3 *Suma: ' + Math.round(totalGrn) + ' hrn*',
          SEP,
          lvlEmoji + ' *+' + pts + ' baliv narakhovano*',
          '   Balans: ' + bal + ' baliv',
          SEP,
          '_Dyakuyemo! Prykhodite znovu \u2615_',
        ].join('\n')

        if (userInfo.telegramId) {
          await tgSend(String(userInfo.telegramId), text)
          app.log.info({ userId: userInfo.userId, pts }, 'Offline order: Telegram sent')
        }
      } catch (e) {
        app.log.error({ err: String(e) }, 'Offline order processing error')
      }
      return
    }

    // INCOMING ORDER CHANGED = status change
    if (p.object === 'incoming_order' && p.action === 'changed') {
      if (!location.posterToken) return

      const posterOrderId = Number(p.object_id)
      const order = await prisma.order.findFirst({
        where: { posterOrderId, locationId: location.id },
        include: { user: true },
      })
      if (!order) { app.log.warn({ posterOrderId }, 'Order not found'); return }
      if (['CANCELLED', 'COMPLETED'].includes(order.status)) return

      try {
        const url = 'https://' + p.account + '.joinposter.com/api/incomingOrders.getIncomingOrder?token=' + location.posterToken + '&incoming_order_id=' + posterOrderId
        const res = await fetch(url)
        const data = await res.json() as any
        const posterStatus = Number(data?.response?.status ?? 0)
        const transactionId = data?.response?.transaction_id
        app.log.info({ posterStatus, transactionId, orderId: order.id }, 'Poster incoming_order status')

        if (posterStatus === 7 && !transactionId) {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
          await tgSend(String(order.user.telegramId), '\u274c Zamovlennya #' + order.id + ' skasovano barysteyu.')
          app.log.info({ orderId: order.id }, 'Order CANCELLED')
        } else if (posterStatus === 2 && order.status === 'SENT_TO_POS') {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'ACCEPTED' } })
          await tgSend(String(order.user.telegramId), '\u2615 Zamovlennya #' + order.id + ' prynyato! Hotuyemo...')
          app.log.info({ orderId: order.id }, 'Order ACCEPTED')
        } else {
          app.log.info({ posterStatus, transactionId }, 'No matching transition')
        }
      } catch (e) {
        app.log.error({ err: String(e) }, 'Error checking Poster order status')
      }
      return
    }

    if (p.object === 'incoming_order' && p.action === 'added') {
      app.log.info({ posterOrderId: p.object_id }, 'incoming_order added - already tracked')
    }
  })
}
