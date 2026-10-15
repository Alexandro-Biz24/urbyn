import { SEOMeta } from '../components/SEOMeta';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';

export function MentionsLegalesPage() {
  const navigate = useNavigate();

  return (
    <>
      <SEOMeta title="Mentions légales" url="/mentions-legales" noIndex />
    <div className="max-w-4xl mx-auto pt-[var(--header-height)] px-4 pb-16">
      <div className="mb-8">
        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className="border-2 border-black"
        >
          ← Retour à l'accueil
        </Button>
      </div>

      <h1 className="text-4xl font-bold mb-6 text-black">Mentions Légales</h1>

      <div className="space-y-8 text-black">
        <section>
          <h2 className="text-2xl font-bold mb-4">1. Éditeur du site</h2>
          <p>
            Le présent site (ci-après « le Site ») est édité par la société Urbanize
            (ci-après « Atelier Urbanize », nom commercial), ci-après désignée « l'Éditeur ».
          </p>
          <p className="mt-4">
            <strong>Raison sociale :</strong> Urbanize<br />
            <strong>Nom commercial :</strong> Atelier Urbanize<br />
            <strong>Forme juridique :</strong> SASU<br />
            <strong>Capital social :</strong> 1 000 €<br />
            <strong>SIREN :</strong> 827 458 779<br />
            <strong>N° TVA intracommunautaire :</strong> FR73827458779<br />
            <strong>RCS :</strong> Paris
          </p>
          <p className="mt-4">
            <strong>Siège social — Bureau Paris</strong><br />
            39 rue Dupleix<br />
            75015 Paris, France
          </p>
          <p className="mt-4">
            <strong>Bureau Dubaï</strong><br />
            Splendour Villa 69, Al Safa 1<br />
            Dubaï, Émirats arabes unis<br />
            Licence n° 1423255
          </p>
          <p className="mt-4">
            <strong>Email :</strong> info@urbanize.site<br />
            <strong>Téléphone :</strong> +33 6 24 20 22 43<br />
            <strong>Directeur de la publication :</strong> Benjamin Rein
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">2. Hébergement</h2>
          <p>
            Le Site est hébergé par :<br />
            Vercel Inc.<br />
            440 N Barranca Avenue #4133<br />
            Covina, CA 91723<br />
            États-Unis<br />
            Contact :{' '}
            <a
              href="https://vercel.com/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              vercel.com/contact
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">3. Accès au site</h2>
          <p>
            Le Site est accessible par tout endroit, 7j/7, 24h/24, sauf cas de force majeure,
            interruption programmée ou non, et pouvant découler d'une nécessité de maintenance.
            En cas de modification, interruption ou suspension du Site, l'Éditeur ne saurait
            être tenu responsable.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">4. Description des services</h2>
          <p>
            Le Site a pour objet de fournir une information concernant l'ensemble des activités
            de la société Atelier Urbanize, organisées autour de deux domaines d'expertise :
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              <strong>Habillage Urbain</strong> : habillage d'échafaudage et de mur, palissades
              de chantier, totems de communication urbaine, massifs béton, panneaux de chantier
              et structures extérieures ;
            </li>
            <li>
              <strong>Habillage Thermique</strong> : toiles de protection pour façades, toiles de
              protection pour patios, films solaires pour vitrages.
            </li>
          </ul>
          <p className="mt-4">
            Le Site donne également accès à <strong>Urbyn</strong>, la plateforme en ligne
            d'Atelier Urbanize permettant d'obtenir une estimation instantanée pour des produits
            relevant de l'Habillage Urbain comme de l'Habillage Thermique. L'Éditeur s'efforce de fournir des informations
            aussi précises que possible, mais ne pourra être tenu responsable des omissions,
            inexactitudes ou carences dans la mise à jour, qu'elles soient de son fait ou du fait
            de tiers partenaires.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">5. Limitations contractuelles techniques</h2>
          <p>
            Le Site utilise la technologie JavaScript. Il ne pourra être tenu responsable de
            dommages matériels liés à l'utilisation du Site. L'utilisateur s'engage à accéder
            au Site en utilisant un matériel récent, ne contenant pas de virus et avec un
            navigateur mis à jour.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">6. Propriété intellectuelle</h2>
          <p>
            L'ensemble de ce Site relève de la législation française et internationale sur le
            droit d'auteur et la propriété intellectuelle. Tous les droits de reproduction sont
            réservés, y compris pour les documents téléchargeables et les représentations
            iconographiques et photographiques. La reproduction de tout ou partie de ce Site
            sur un support électronique ou autre est formellement interdite sauf autorisation
            expresse de l'Éditeur.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">7. Limitations de responsabilité</h2>
          <p>
            L'Éditeur ne pourra être tenu responsable des dommages directs et indirects causés
            au matériel de l'utilisateur lors de l'accès au Site, résultant soit de l'utilisation
            d'un matériel ne répondant pas aux spécifications, soit de l'apparition d'un bug ou
            d'une incompatibilité. L'Éditeur ne pourra également être tenu responsable des
            dommages indirects consécutifs à l'utilisation du Site.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">8. Données personnelles</h2>
          <p>
            Les informations recueillies sur le Site font l'objet d'un traitement informatique
            destiné à la gestion des demandes de contact, des devis et des commandes.
            Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi
            « Informatique et Libertés », vous disposez d'un droit d'accès, de rectification,
            de suppression et d'opposition aux données vous concernant, que vous pouvez exercer
            en écrivant à info@urbanize.site.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">9. Liens hypertextes et cookies</h2>
          <p>
            Le Site contient des liens hypertextes vers d'autres sites. L'Éditeur n'a pas la
            possibilité de vérifier le contenu des sites ainsi visités et n'assumera aucune
            responsabilité de ce fait. La navigation sur le Site est susceptible de provoquer
            l'installation de cookies sur l'ordinateur de l'utilisateur. Un cookie ne permet pas
            d'identifier l'utilisateur ; il enregistre des informations relatives à la navigation.
            Pour plus de détails, consultez notre{' '}
            <button onClick={() => navigate('/cookies')} className="underline font-bold">
              politique de cookies
            </button>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">10. Droit applicable et juridiction</h2>
          <p>
            Tout litige en relation avec l'utilisation du Site est soumis au droit français.
            Il est fait attribution exclusive de juridiction aux tribunaux compétents de Paris.
          </p>
        </section>
      </div>
    </div>
    </>
  );
}
