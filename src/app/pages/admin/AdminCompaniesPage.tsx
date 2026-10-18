import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAdminCompanies, type AdminCompanyListItem } from '../../api/adminAccounts'
import { AdminTopBar } from './AdminDashboardPage'
import { AdminSplitTable } from './AdminAccountsShared'
import './Admin.css'

function CompanyTable({
  rows,
  linkPrefix,
}: {
  rows: AdminCompanyListItem[]
  linkPrefix: string
}) {
  if (rows.length === 0) return null
  return (
    <table className="admin-data-table">
      <thead>
        <tr>
          <th>Société</th>
          <th>TVA</th>
          <th>Ville</th>
          <th>Users</th>
          <th>Produits</th>
          <th>Abonné</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.tva_intra_com}>
            <td>
              <Link
                to={`${linkPrefix}/${encodeURIComponent(c.tva_intra_com)}`}
                className="admin-data-table__link"
              >
                {c.company_name}
              </Link>
            </td>
            <td>{c.tva_intra_com}</td>
            <td>{c.city ?? '—'}</td>
            <td>{c.user_count}</td>
            <td>{c.product_count}</td>
            <td>{c.abonne ? 'Oui' : 'Non'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AdminCompaniesPage() {
  const [suppliers, setSuppliers] = useState<AdminCompanyListItem[]>([])
  const [clients, setClients] = useState<AdminCompanyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAdminCompanies()
      .then((data) => {
        setSuppliers(data.suppliers)
        setClients(data.clients)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="admin-page">
      <AdminTopBar title="Sociétés" />
      <main className="admin-page__main">
        <p className="admin-page__lead">
          Sociétés partenaires à gauche, clients à droite. Cliquez pour la fiche détail.
        </p>
        {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}
        {loading ? (
          <p className="admin-catalog__hint">Chargement…</p>
        ) : (
          <AdminSplitTable
            leftTitle="Partenaires"
            rightTitle="Clients"
            leftRows={<CompanyTable rows={suppliers} linkPrefix="/admin/societes" />}
            rightRows={<CompanyTable rows={clients} linkPrefix="/admin/societes" />}
          />
        )}
      </main>
    </div>
  )
}
