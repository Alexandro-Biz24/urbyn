import { useEffect, useRef, useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { getApiBase, resolveApiBase } from '../api/apiBase'

type Props = {
  /** Clé stable mappée côté backend → ID fichier Drive (ex. caisson-bois-120, sign-iz) */
  documentKey: string
  className?: string
  label?: string
  /**
   * Précharge le PDF dès l’arrivée sur la page (cache mémoire navigateur).
   * Vidangé automatiquement au démontage (sortie de page / navigation).
   */
  prefetch?: boolean
}

/**
 * Bouton outline cohérent avec l'UI totem.
 * Le PDF est servi par le backend (proxy Drive) — aucun secret côté front.
 * Avec prefetch: le fichier est déjà en mémoire quand l’utilisateur clique.
 */
export function FicheTechniqueButton({
  documentKey,
  className,
  label = 'Télécharger la fiche technique',
  prefetch = true,
}: Props) {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [prefetchReady, setPrefetchReady] = useState(false)

  const blobRef = useRef<Blob | null>(null)
  const prefetchPromiseRef = useRef<Promise<Blob> | null>(null)

  useEffect(() => {
    let cancelled = false
    const abort = new AbortController()

    blobRef.current = null
    prefetchPromiseRef.current = null
    setAvailable(null)
    setError(null)
    setPdfUrl(null)
    setPrefetchReady(false)

    ;(async () => {
      try {
        await resolveApiBase()
        if (cancelled) return
        const base = getApiBase()
        const encoded = encodeURIComponent(documentKey)
        const url = `${base}/api/v1/documents/fiche-technique/${encoded}`
        setPdfUrl(url)

        const statusRes = await fetch(
          `${base}/api/v1/documents/fiche-technique/${encoded}/status`,
          { signal: abort.signal },
        )
        if (!statusRes.ok) {
          if (!cancelled) setAvailable(false)
          return
        }
        const data = (await statusRes.json()) as { available?: boolean }
        const isAvailable = Boolean(data.available)
        if (cancelled) return
        setAvailable(isAvailable)
        if (!isAvailable || !prefetch) return

        // Prefetch en arrière-plan pendant que l’utilisateur lit / configure.
        const promise = (async () => {
          const res = await fetch(url, { signal: abort.signal })
          if (!res.ok) {
            let message = 'Fiche technique indisponible pour le moment.'
            try {
              const body = await res.json()
              if (body?.detail?.message) message = body.detail.message
            } catch {
              /* ignore */
            }
            throw new Error(message)
          }
          return res.blob()
        })()

        prefetchPromiseRef.current = promise
        try {
          const blob = await promise
          if (cancelled) return
          blobRef.current = blob
          setPrefetchReady(true)
        } catch (e) {
          if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return
          prefetchPromiseRef.current = null
          // Prefetch échoué : le clic retentera un fetch classique.
        }
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return
        setAvailable(false)
      }
    })()

    return () => {
      cancelled = true
      abort.abort()
      // Vide le cache mémoire dès qu’on quitte la page.
      blobRef.current = null
      prefetchPromiseRef.current = null
    }
  }, [documentKey, prefetch])

  const triggerBrowserDownload = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fiche-technique-${documentKey}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Révoque juste après le clic — le blob en mémoire (blobRef) reste pour un 2e clic.
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }

  const handleDownload = async () => {
    if (!pdfUrl) return
    setLoading(true)
    setError(null)
    try {
      let blob = blobRef.current
      if (!blob && prefetchPromiseRef.current) {
        // Prefetch encore en cours : on attend le même fetch (pas de 2e requête).
        blob = await prefetchPromiseRef.current
        blobRef.current = blob
        setPrefetchReady(true)
      }
      if (!blob) {
        const res = await fetch(pdfUrl)
        if (!res.ok) {
          let message = 'Fiche technique indisponible pour le moment.'
          try {
            const body = await res.json()
            if (body?.detail?.message) message = body.detail.message
          } catch {
            /* ignore */
          }
          throw new Error(message)
        }
        blob = await res.blob()
        blobRef.current = blob
        setPrefetchReady(true)
      }
      triggerBrowserDownload(blob)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      const msg =
        e instanceof TypeError
          ? "Impossible de joindre l'API (Failed to fetch). Vérifie que le backend tourne et l'URL VITE_API_URL_WEB."
          : e instanceof Error
            ? e.message
            : 'Téléchargement impossible'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const disabled = loading || available === false || available === null || !pdfUrl

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => void handleDownload()}
        className="w-full border-2 border-black bg-white text-black hover:bg-black hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <FileDown className="w-4 h-4 mr-2" />
        )}
        {loading
          ? prefetchReady
            ? 'Téléchargement…'
            : 'Récupération…'
          : label}
      </Button>
      {available === false ? (
        <p className="text-xs text-gray-400 mt-2">
          Fiche technique bientôt disponible.
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-600 mt-2">{error}</p> : null}
    </div>
  )
}
