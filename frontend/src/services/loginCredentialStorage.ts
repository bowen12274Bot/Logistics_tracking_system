export type SavedCredential = {
    email: string
    password: string
    label: string
    updatedAt: string
}

export type LoginCredentialStorage = {
    version: 1
    credentials: SavedCredential[]
}

const STORAGE_KEY = 'logisim-login-credentials:v1'

const emptyData = (): LoginCredentialStorage => ({
    version: 1,
    credentials: [],
})

function uniqCredentialPush(list: SavedCredential[], next: Omit<SavedCredential, 'updatedAt'>, limit = 20) {
    const email = String(next.email ?? '').trim()
    const password = String(next.password ?? '').trim()
    const label = String(next.label ?? '').trim()

    if (!email || !password) return list

    const updatedAt = new Date().toISOString()
    // Remove duplicates based on email
    const deduped = list.filter((c) => c.email !== email)
    return [{ email, password, label, updatedAt }, ...deduped].slice(0, limit)
}

export function loadLoginCredentials(): LoginCredentialStorage {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return emptyData()
        const parsed = JSON.parse(raw)
        if (!parsed || parsed.version !== 1) return emptyData()
        return {
            version: 1,
            credentials: Array.isArray(parsed.credentials) ? parsed.credentials : [],
        }
    } catch {
        return emptyData()
    }
}

export function saveLoginCredentials(data: LoginCredentialStorage) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function addCredential(data: LoginCredentialStorage, next: Omit<SavedCredential, 'updatedAt'>) {
    return { ...data, credentials: uniqCredentialPush(data.credentials, next) }
}

export function removeCredential(data: LoginCredentialStorage, index: number) {
    if (index < 0 || index >= data.credentials.length) return data
    const credentials = data.credentials.slice()
    credentials.splice(index, 1)
    return { ...data, credentials }
}
