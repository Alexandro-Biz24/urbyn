import { useState } from 'react'
import type { CatalogCsvImportMode, CatalogCsvImportRowError } from '../../api/admin'

export function CsvDropzone({
  file,
  onFile,
}: {
  file: File | null
  onFile: (file: File) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  function accept(next: File | null | undefined) {
    if (!next) return
    if (!next.name.toLowerCase().endsWith('.csv') && next.type !== 'text/csv') return
    onFile(next)
  }

  return (
    <div
      className={`admin-csv-dropzone ${dragOver ? 'is-dragover' : ''} ${file ? 'has-file' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        accept(e.dataTransfer.files?.[0])
      }}
    >
      <p>
        {file ? `Fichier : ${file.name}` : 'Glissez-déposez un CSV ici, ou cliquez pour parcourir'}
      </p>
      <input type="file" accept=".csv,text/csv" onChange={(e) => accept(e.target.files?.[0])} />
    </div>
  )
}

export function CsvModeField({
  name,
  mode,
  onChange,
  destructiveHint,
}: {
  name: string
  mode: CatalogCsvImportMode
  onChange: (mode: CatalogCsvImportMode) => void
  destructiveHint: string
}) {
  return (
    <fieldset className="admin-csv-import__modes">
      <legend>Mode</legend>
      <label>
        <input
          type="radio"
          name={name}
          checked={mode === 'additive'}
          onChange={() => onChange('additive')}
        />
        Additive
      </label>
      <label>
        <input
          type="radio"
          name={name}
          checked={mode === 'destructive'}
          onChange={() => onChange('destructive')}
        />
        Destructive — {destructiveHint}
      </label>
    </fieldset>
  )
}

export function CsvErrorList({
  label,
  items,
}: {
  label?: string
  items: CatalogCsvImportRowError[]
}) {
  if (!items.length) return null
  return (
    <div className="admin-csv-errors">
      <p>
        {label ?? 'Erreurs'} ({items.length})
      </p>
      <ul>
        {items.slice(0, 40).map((err, i) => (
          <li key={`${err.line}-${i}`}>
            Ligne {err.line} — {err.message}
          </li>
        ))}
      </ul>
      {items.length > 40 ? <p>… et {items.length - 40} de plus</p> : null}
    </div>
  )
}
