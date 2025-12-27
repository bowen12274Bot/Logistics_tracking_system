export type CommonRecipient = {
  name: string
  phone: string
  address: string
  updatedAt: string
}

export type CustomerCommonRecipients = {
  version: 2
  recipients: CommonRecipient[]
}

const STORAGE_PREFIX = 'logisim-customer-common:v2:'

const emptyData = (): CustomerCommonRecipients => ({
  version: 2,
  recipients: [],
})

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`
}

function uniqRecipientPush(list: CommonRecipient[], next: Omit<CommonRecipient, 'updatedAt'>, limit = 12) {
  const name = String(next.name ?? '').trim()
  const phone = String(next.phone ?? '').trim()
  const address = String(next.address ?? '').trim().toUpperCase()
  if (!name || !phone || !address) return list

  const updatedAt = new Date().toISOString()
  const deduped = list.filter((r) => !(r.name === name && r.phone === phone && r.address === address))
  return [{ name, phone, address, updatedAt }, ...deduped].slice(0, limit)
}

export function loadCustomerCommonRecipients(userId?: string | null): CustomerCommonRecipients {
  if (!userId) return emptyData()
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return emptyData()
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== 2) return emptyData()
    return {
      version: 2,
      recipients: Array.isArray(parsed.recipients) ? parsed.recipients : [],
    }
  } catch {
    return emptyData()
  }
}

export function saveCustomerCommonRecipients(userId: string | null | undefined, data: CustomerCommonRecipients) {
  if (!userId) return
  localStorage.setItem(storageKey(userId), JSON.stringify(data))
}

export function addCommonRecipient(data: CustomerCommonRecipients, next: Omit<CommonRecipient, 'updatedAt'>) {
  return { ...data, recipients: uniqRecipientPush(data.recipients, next) }
}

export function removeCommonRecipient(data: CustomerCommonRecipients, index: number) {
  if (index < 0 || index >= data.recipients.length) return data
  const recipients = data.recipients.slice()
  recipients.splice(index, 1)
  return { ...data, recipients }
}

