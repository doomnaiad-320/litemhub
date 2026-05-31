const CHUNK_LOAD_RELOAD_KEY = 'aiproxy:chunk-load-reloaded'

export const isChunkLoadError = (error: unknown) => {
    if (!(error instanceof Error)) {
        return false
    }

    const message = error.message || ''
    return (
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('Importing a module script failed') ||
        message.includes('error loading dynamically imported module') ||
        message.includes('Loading chunk') ||
        message.includes('ChunkLoadError')
    )
}

export const reloadOnceForChunkLoadError = () => {
    if (typeof window === 'undefined') {
        return false
    }

    if (sessionStorage.getItem(CHUNK_LOAD_RELOAD_KEY) === '1') {
        return false
    }

    sessionStorage.setItem(CHUNK_LOAD_RELOAD_KEY, '1')
    window.location.reload()

    return true
}
