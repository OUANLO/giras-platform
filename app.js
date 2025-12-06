import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const { useState, useEffect } = React;

// --- Supabase client (update with your values) ---
const SUPABASE_URL = 'https://zztvjdbebpkwadntlcti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6dHZqZGJlYnBrd2FkbnRsY3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1Mjg3MTQsImV4cCI6MjA4MDEwNDcxNH0.zCcHdU6-D3to3lb7nTVYjGwUcb8iGZgDzcD06x5LHmc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Utility helpers ---

async function exportTableToExcel(tableId, filename = 'export.xlsx') {
  const table = document.getElementById(tableId);
  if (!table) return;
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Feuil1' });
  XLSX.writeFile(wb, filename);
}

function classNames(...args) {
  return args.filter(Boolean).join(' ');
}

// --- Generic components ---

function Modal({ title, open, onClose, children, footer }) {
  if (!open) return null;
  return (
    React.createElement('div', { className: 'modal-backdrop', onClick: onClose },
      React.createElement('div', { className: 'modal', onClick: (e) => e.stopPropagation() },
        React.createElement('div', { className: 'modal-header' },
          React.createElement('div', { className: 'modal-title' }, title),
          React.createElement('button', { className: 'icon-btn', onClick: onClose }, '✕')
        ),
        React.createElement('div', { className: 'modal-body' }, children),
        footer && React.createElement('div', { style: { marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 } }, footer)
      )
    )
  );
}

function StatCard({ label, value, sub, variant }) {
  const colorMap = {
    success: 'pill-success',
    warning: 'pill-warning',
    danger: 'pill-danger',
    info: 'pill-info'
  };
  return (
    React.createElement('div', { className: 'stat-card' },
      React.createElement('div', { className: 'stat-label' }, label),
      React.createElement('div', { className: 'stat-value' }, value ?? '0'),
      sub && React.createElement('div', { className: 'stat-sub' }, sub)
    )
  );
}

// --- Login page ---

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('fousseni.ouattara@ipscnam.ci');
  const [password, setPassword] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Here we use Supabase Auth as a practical implementation.
      // Make sure to create a user with this email in Supabase auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;

      // Fetch profile from custom "User" table
      const { data: profile, error: profileError } = await supabase
        .from('User')
        .select('*')
        .eq('Username', email)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile || profile.Statut !== 'Actif') {
        throw new Error('Utilisateur inactif ou non trouvé dans la table User.');
      }

      onLogin({ auth: data.session, profile });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erreur de connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    React.createElement('div', { className: 'login-wrapper' },
      React.createElement('div', { className: 'login-card' },
        React.createElement('div', { className: 'login-logo' },
          React.createElement('img', { src: 'logos/LOGO_GIRAS.png', alt: 'GIRAS' }),
          React.createElement('div', { className: 'login-title' }, 'Gestion Intégrée des Risques et Activités Stratégiques')
        ),
        error && React.createElement('div', { className: 'pill pill-danger', style: { marginBottom: 8 } }, error),
        React.createElement('form', { className: 'login-form', onSubmit: handleSubmit },
          React.createElement('div', null,
            React.createElement('label', null, 'Username (Email)'),
            React.createElement('input', {
              type: 'email',
              required: true,
              value: email,
              onChange: (e) => setEmail(e.target.value)
            })
          ),
          React.createElement('div', null,
            React.createElement('label', null, 'Mot de passe'),
            React.createElement('input', {
              type: 'password',
              required: true,
              minLength: 8,
              value: password,
              onChange: (e) => setPassword(e.target.value)
            })
          ),
          React.createElement('button', { type: 'submit', className: 'btn', disabled: loading },
            loading ? 'Connexion...' : 'Se connecter'
          )
        )
      )
    )
  );
}

// --- Layout shell ---

const RUBRIQUES = [
  { id: 'accueil', label: 'Accueil', icon: '🏠' },
  { id: 'risques', label: 'Gestion des risques', icon: '⚠️' },
  { id: 'activites', label: 'Suivi des activités', icon: '📅' },
  { id: 'indicateurs', label: 'Suivi des indicateurs', icon: '📊' },
  { id: 'performances', label: 'Suivi des performances', icon: '⭐' },
  { id: 'tableau', label: 'Tableau de bord', icon: '📈' },
  { id: 'admin', label: 'Administration', icon: '🛠️' },
];

function AppShell({ user, onLogout }) {
  const [rubrique, setRubrique] = useState(user.profile.Type_utilisateur === 'Super manager' ? 'tableau' : 'accueil');
  const [flashMessage, setFlashMessage] = useState('Bienvenue sur la plateforme GIRAS. Paramétrez vos messages flash dans la table "Infos_flash" de Supabase.');
  const [showPwdModal, setShowPwdModal] = useState(false);

  const fullName = user.profile.Nom + ' ' + user.profile.Prenoms;

  function handleChangePwd() {
    setShowPwdModal(true);
  }

  return (
    React.createElement('div', { className: 'app-shell' },
      React.createElement('header', { className: 'app-header' },
        React.createElement('div', { className: 'header-left' },
          React.createElement('div', { className: 'header-logos' },
            React.createElement('img', { src: 'logos/LOGO_GIRAS.png', alt: 'GIRAS' }),
            React.createElement('div', { className: 'header-divider' }),
            React.createElement('img', { src: 'logos/Logo_CNAM.png', alt: 'CNAM' })
          ),
          React.createElement('div', { className: 'header-title' }, 'Gestion Intégrée des Risques et des Activités Stratégiques')
        ),
        React.createElement('div', { className: 'header-right' },
          React.createElement('span', {
            className: 'user-name',
            onClick: handleChangePwd,
            style: { cursor: 'pointer' }
          }, fullName),
          React.createElement('button', { className: 'btn-outline btn', onClick: onLogout }, 'Déconnexion')
        )
      ),
      React.createElement('div', { className: 'flash-banner' },
        React.createElement('span', { className: 'flash-label' }, 'Infos flash :'),
        React.createElement('div', { className: 'flash-marquee' }, flashMessage)
      ),
      React.createElement('nav', { className: 'top-nav' },
        RUBRIQUES.map((r) => React.createElement('div', {
          key: r.id,
          className: classNames('nav-item', rubrique === r.id && 'active'),
          onClick: () => setRubrique(r.id)
        }, React.createElement('span', null, r.icon), React.createElement('span', null, r.label)))
      ),
      React.createElement('main', { className: 'app-main' },
        React.createElement(Sidebar, { rubrique, setRubrique, role: user.profile.Type_utilisateur }),
        React.createElement('div', { className: 'content' },
          rubrique === 'accueil' && React.createElement(AccueilPage, { setRubrique, user }),
          rubrique === 'risques' && React.createElement(GestionRisques, { user }),
          rubrique === 'activites' && React.createElement(SuiviActivites, { user }),
          rubrique === 'indicateurs' && React.createElement(SuiviIndicateurs, { user }),
          rubrique === 'performances' && React.createElement(SuiviPerformances, { user }),
          rubrique === 'tableau' && React.createElement(TableauDeBord, { user }),
          rubrique === 'admin' && React.createElement(AdministrationPage, { user })
        )
      ),
      React.createElement(ChangePasswordModal, {
        open: showPwdModal,
        onClose: () => setShowPwdModal(false),
        user
      })
    )
  );
}

function Sidebar({ rubrique, setRubrique, role }) {
  if (rubrique === 'accueil') return null;
  let buttons = [];
  if (rubrique === 'risques') {
    buttons = [
      'Identification',
      'Analyse',
      'Evaluation',
      'Cartographie',
      'Plan de maîtrise',
      'Synthèse des risques',
      'Gestion'
    ];
  } else if (rubrique === 'activites') {
    buttons = ['Projets', 'Actions', 'Tâches'];
  } else if (rubrique === 'indicateurs') {
    buttons = ['Groupes', 'Indicateurs'];
  } else if (rubrique === 'tableau') {
    buttons = ['Indicateurs', 'Actions', 'Risques'];
  } else if (rubrique === 'performances') {
    buttons = ['Scores', 'Structures'];
  } else if (rubrique === 'admin') {
    buttons = ['Utilisateurs', 'Structures', 'Processus', 'Flash infos'];
  }

  return (
    React.createElement('aside', { className: 'sidebar' },
      React.createElement('div', { className: 'sidebar-title' }, rubrique.toUpperCase()),
      buttons.map((b) =>
        React.createElement('button', {
          key: b,
          className: 'sidebar-btn',
        }, b)
      )
    )
  );
}

// --- Password change modal (simplified, using Brevo via Vercel API) ---

function ChangePasswordModal({ open, onClose, user }) {
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [status, setStatus] = useState(null);

  async function sendCode() {
    setStatus('Envoi du code...');
    try {
      const resp = await fetch('/api/sendEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.profile.Username,
          subject: 'Code de vérification GIRAS',
          message: 'Votre code de vérification temporaire est: 123456'
        })
      });
      if (!resp.ok) throw new Error('Échec de l’envoi du mail');
      setCodeSent(true);
      setStatus('Code envoyé à votre adresse e-mail (code de démonstration: 123456)');
    } catch (e) {
      console.error(e);
      setStatus('Erreur lors de l’envoi du mail.');
    }
  }

  async function handleSave() {
    if (verificationCode !== '123456') {
      setStatus('Code de vérification incorrect.');
      return;
    }
    if (newPassword.length < 8) {
      setStatus('Le mot de passe doit avoir au moins 8 caractères.');
      return;
    }
    if (newPassword !== newPassword2) {
      setStatus('Les deux mots de passe ne sont pas identiques.');
      return;
    }
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setStatus('Mot de passe modifié. Vous allez être redirigé vers la page de connexion.');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e) {
      console.error(e);
      setStatus('Erreur lors de la modification du mot de passe.');
    }
  }

  return (
    React.createElement(Modal, {
      title: 'Modifier mon mot de passe',
      open,
      onClose
    },
      React.createElement('div', { className: 'form-grid' },
        React.createElement('div', null,
          React.createElement('label', null, 'Adresse mail'),
          React.createElement('input', { type: 'email', value: user.profile.Username, readOnly: true })
        ),
        React.createElement('div', null,
          React.createElement('label', null, 'Code de vérification'),
          React.createElement('input', {
            type: 'text',
            value: verificationCode,
            onChange: (e) => setVerificationCode(e.target.value)
          })
        ),
        React.createElement('div', null,
          React.createElement('label', null, 'Nouveau mot de passe'),
          React.createElement('input', {
            type: 'password',
            value: newPassword,
            minLength: 8,
            onChange: (e) => setNewPassword(e.target.value)
          })
        ),
        React.createElement('div', null,
          React.createElement('label', null, 'Confirmer le nouveau mot de passe'),
          React.createElement('input', {
            type: 'password',
            value: newPassword2,
            minLength: 8,
            onChange: (e) => setNewPassword2(e.target.value)
          })
        )
      ),
      status && React.createElement('div', { style: { marginTop: 8, fontSize: '0.8rem' } }, status),
      React.createElement(React.Fragment, null,
        React.createElement('button', { className: 'btn-outline btn', type: 'button', onClick: sendCode }, 'Envoyer le code'),
        React.createElement('button', { className: 'btn', type: 'button', onClick: handleSave }, 'Enregistrer')
      )
    )
  );
}

// --- Accueil ---

function AccueilPage({ setRubrique, user }) {
  const buttons = [
    { id: 'risques', label: 'Gestion des risques', icon: '⚠️' },
    { id: 'activites', label: 'Suivi des activités', icon: '📅' },
    { id: 'indicateurs', label: 'Suivi des indicateurs', icon: '📊' },
    { id: 'performances', label: 'Suivi des performances', icon: '⭐' },
    { id: 'tableau', label: 'Tableau de bord', icon: '📈' },
    { id: 'admin', label: 'Administration', icon: '🛠️' },
  ];

  return (
    React.createElement('div', null,
      React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('div', { className: 'card-title' }, 'Rubriques principales')
        ),
        React.createElement('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 16,
            justifyItems: 'center'
          }
        },
          buttons.map((b) =>
            React.createElement('button', {
              key: b.id,
              className: 'btn',
              onClick: () => setRubrique(b.id)
            }, b.icon, b.label)
          )
        )
      ),
      React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('div', { className: 'card-title' }, 'Risques en attente de quantification (exemple démo)')
        ),
        React.createElement('p', null,
          'Cette section devra afficher le nombre de risques en attente de renseignement des indicateurs ou de l’index de probabilité pour la période ouverte. ',
          'La logique métier complète sera appliquée côté Supabase (vues SQL) puis affichée ici.'
        )
      )
    )
  );
}

// --- Gestion des risques (skeleton with Identification + Cartographie demo) ---

function GestionRisques({ user }) {
  return (
    React.createElement('div', null,
      React.createElement(RisqueIdentificationSection, { user }),
      React.createElement('div', { style: { marginTop: 24 } },
        React.createElement(RisqueCartographieSection, { user })
      )
    )
  );
}

function RisqueIdentificationSection({ user }) {
  const [risques, setRisques] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ Code_risque: '', Libelle_risque: '', Code_processus: '', Impact: 1, Efficacite_contr: 1 });

  async function loadRisques() {
    setLoading(true);
    const { data, error } = await supabase.from('Risque').select('Code_risque,Libelle_risque,Code_processus,Impact,Efficacite_contr,Statut').order('Code_risque');
    if (!error && data) setRisques(data);
    setLoading(false);
  }

  useEffect(() => { loadRisques(); }, []);

  async function saveRisque() {
    // Very partial implementation: only mandatory subset
    const payload = {
      Code_risque: formData.Code_risque,
      Libelle_risque: formData.Libelle_risque,
      Code_processus: formData.Code_processus,
      Impact: Number(formData.Impact),
      Efficacite_contr: Number(formData.Efficacite_contr),
      Statut: 'Actif',
      Createur: user.profile.Username,
    };
    const { error } = await supabase.from('Risque').insert(payload);
    if (!error) {
      setShowForm(false);
      setFormData({ Code_risque: '', Libelle_risque: '', Code_processus: '', Impact: 1, Efficacite_contr: 1 });
      loadRisques();
    } else {
      alert('Erreur lors de la sauvegarde du risque: ' + error.message);
    }
  }

  return (
    React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('div', { className: 'card-title' }, 'Identification des risques'),
        React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement('button', { className: 'btn', onClick: () => setShowForm(true) }, '+ Nouveau risque'),
          React.createElement('button', { className: 'btn-outline btn', onClick: () => exportTableToExcel('risques-table', 'risques.xlsx') }, 'Export Excel')
        )
      ),
      React.createElement('div', { className: 'filter-row' },
        React.createElement('input', { placeholder: 'Recherche (code, libellé, processus)...' })
      ),
      loading ? React.createElement('p', null, 'Chargement des risques...') :
        React.createElement('div', { className: 'table-wrapper' },
          React.createElement('table', { id: 'risques-table' },
            React.createElement('thead', null,
              React.createElement('tr', null,
                React.createElement('th', null, 'Code_risque'),
                React.createElement('th', null, 'Libellé risque'),
                React.createElement('th', null, 'Code processus'),
                React.createElement('th', null, 'Impact'),
                React.createElement('th', null, 'Efficacité contrôle'),
                React.createElement('th', null, 'Statut')
              )
            ),
            React.createElement('tbody', null,
              risques.map((r) =>
                React.createElement('tr', { key: r.Code_risque },
                  React.createElement('td', null, r.Code_risque),
                  React.createElement('td', null, r.Libelle_risque),
                  React.createElement('td', null, r.Code_processus),
                  React.createElement('td', null, r.Impact),
                  React.createElement('td', null, r.Efficacite_contr),
                  React.createElement('td', null,
                    React.createElement('span', { className: classNames('pill', r.Statut === 'Actif' ? 'pill-success' : 'pill-warning') }, r.Statut)
                  )
                )
              )
            )
          )
        ),
      React.createElement(Modal, {
        title: 'Nouveau risque',
        open: showForm,
        onClose: () => setShowForm(false),
        footer: React.createElement(React.Fragment, null,
          React.createElement('button', { className: 'btn-outline btn', type: 'button', onClick: () => setShowForm(false) }, 'Annuler'),
          React.createElement('button', { className: 'btn', type: 'button', onClick: saveRisque }, 'Enregistrer')
        )
      },
        React.createElement('div', { className: 'form-grid' },
          React.createElement('div', null,
            React.createElement('label', null, 'Code_risque (6 caractères)'),
            React.createElement('input', {
              maxLength: 6,
              value: formData.Code_risque,
              onChange: (e) => setFormData({ ...formData, Code_risque: e.target.value })
            })
          ),
          React.createElement('div', null,
            React.createElement('label', null, 'Libellé risque'),
            React.createElement('input', {
              value: formData.Libelle_risque,
              onChange: (e) => setFormData({ ...formData, Libelle_risque: e.target.value })
            })
          ),
          React.createElement('div', null,
            React.createElement('label', null, 'Code processus'),
            React.createElement('input', {
              value: formData.Code_processus,
              onChange: (e) => setFormData({ ...formData, Code_processus: e.target.value })
            })
          ),
          React.createElement('div', null,
            React.createElement('label', null, 'Impact (1-4)'),
            React.createElement('input', {
              type: 'number',
              min: 1,
              max: 4,
              value: formData.Impact,
              onChange: (e) => setFormData({ ...formData, Impact: e.target.value })
            })
          ),
          React.createElement('div', null,
            React.createElement('label', null, 'Efficacité contrôles (1-4)'),
            React.createElement('input', {
              type: 'number',
              min: 1,
              max: 4,
              value: formData.Efficacite_contr,
              onChange: (e) => setFormData({ ...formData, Efficacite_contr: e.target.value })
            })
          )
        )
      )
    )
  );
}

// Cartographie simple (affichage dans une matrice 4x4)
function RisqueCartographieSection({ user }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function load() {
      // Expect a Supabase view "V_Risque_Evaluation" with Code_risque, Impact, Probabilite, Criticite
      const { data, error } = await supabase.from('V_Risque_Evaluation').select('Code_risque,Impact,Probabilite,Criticite');
      if (!error && data) setData(data);
    }
    load();
  }, []);

  const cells = [];
  for (let impact = 1; impact <= 4; impact++) {
    for (let prob = 1; prob <= 4; prob++) {
      const risques = data.filter(r => r.Impact === impact && r.Probabilite === prob);
      let colorClass = 'hm-green';
      const criticiteMax = risques.reduce((m, r) => Math.max(m, r.Criticite || 0), 0);
      if (criticiteMax >= 37) colorClass = 'hm-red';
      else if (criticiteMax >= 19) colorClass = 'hm-orange';
      else if (criticiteMax >= 10) colorClass = 'hm-yellow';
      cells.push({ impact, prob, colorClass, risques });
    }
  }

  return (
    React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('div', { className: 'card-title' }, 'Cartographie des risques (démo)'),
        React.createElement('button', { className: 'btn-outline btn', onClick: () => exportTableToExcel('heatmap-table', 'cartographie.xlsx') }, 'Exporter tableau')
      ),
      React.createElement('div', { className: 'filter-row' },
        React.createElement('select', null,
          React.createElement('option', null, 'Catégorie (filtre à implémenter via Supabase)')
        )
      ),
      React.createElement('div', { className: 'heatmap-grid', style: { marginBottom: 16 } },
        cells.map((c, idx) =>
          React.createElement('div', { key: idx, className: classNames('heatmap-cell', c.colorClass) },
            React.createElement('div', { className: 'heatmap-header' },
              'I=', c.impact, ' / P=', c.prob
            ),
            React.createElement('div', { className: 'heatmap-codes' },
              c.risques.slice(0, 50).map((r) =>
                React.createElement('span', { key: r.Code_risque, className: 'heatmap-code-pill' }, r.Code_risque)
              )
            )
          )
        )
      ),
      React.createElement('div', { className: 'table-wrapper' },
        React.createElement('table', { id: 'heatmap-table' },
          React.createElement('thead', null,
            React.createElement('tr', null,
              React.createElement('th', null, 'Code processus'),
              React.createElement('th', null, 'Libellé processus'),
              React.createElement('th', null, 'Code risque'),
              React.createElement('th', null, 'Libellé risque'),
              React.createElement('th', null, 'Impact'),
              React.createElement('th', null, 'Probabilité'),
              React.createElement('th', null, 'Efficacité contrôle'),
              React.createElement('th', null, 'Score')
            )
          ),
          React.createElement('tbody', null,
            // For demo purposes we reuse V_Risque_Evaluation; you can join with Processus in a view
            data.map((r) =>
              React.createElement('tr', { key: r.Code_risque },
                React.createElement('td', null, ''), // Code_processus via vue SQL
                React.createElement('td', null, ''), // Libelle_processus
                React.createElement('td', null, r.Code_risque),
                React.createElement('td', null, ''), // Libelle_risque
                React.createElement('td', null, r.Impact),
                React.createElement('td', null, r.Probabilite),
                React.createElement('td', null, ''), // Efficacite_contr
                React.createElement('td', null, r.Criticite ?? '')
              )
            )
          )
        )
      )
    )
  );
}

// --- Placeholders for other sections (to be extended with full business rules) ---

function SuiviActivites() {
  return (
    React.createElement('div', null,
      React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-title' }, 'Suivi des activités'),
        React.createElement('p', null, 'La structure des projets, actions, occurrences et tâches sera reliée aux tables correspondantes dans Supabase. Les filtres et exports fonctionneront de la même manière que dans la section des risques.')
      )
    )
  );
}

function SuiviIndicateurs() {
  return (
    React.createElement('div', null,
      React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-title' }, 'Suivi des indicateurs'),
        React.createElement('p', null, 'Cette section présentera les groupes d’indicateurs et les occurrences, avec mise en forme conditionnelle (cible atteinte ou non) et statistiques de collecte.')
      )
    )
  );
}

function SuiviPerformances() {
  return (
    React.createElement('div', null,
      React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-title' }, 'Suivi des performances'),
        React.createElement('p', null, 'Les scores de performance des employés et des structures seront calculés via des vues SQL dans Supabase et affichés ici.')
      )
    )
  );
}

function TableauDeBord() {
  return (
    React.createElement('div', null,
      React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-title' }, 'Tableau de bord unifié'),
        React.createElement('p', null, 'Cette page présentera des indicateurs de synthèse sur les risques, actions et indicateurs, avec graphiques à barres horizontales et statistiques clés.')
      )
    )
  );
}

function AdministrationPage() {
  return (
    React.createElement('div', null,
      React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-title' }, 'Administration'),
        React.createElement('p', null, 'Gestion des utilisateurs, structures, processus et messages flash (Infos_flash) reliée directement à Supabase.')
      )
    )
  );
}

// --- Root app ---

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const email = data.session.user.email;
        const { data: profile } = await supabase.from('User').select('*').eq('Username', email).maybeSingle();
        if (profile && profile.Statut === 'Actif') {
          setUser({ auth: data.session, profile });
        }
      }
      setChecking(false);
    })();
  }, []);

  if (checking) return React.createElement('p', { style: { padding: 24 } }, 'Chargement...');

  if (!user) {
    return React.createElement(LoginPage, { onLogin: setUser });
  }

  return React.createElement(AppShell, {
    user,
    onLogout: async () => {
      await supabase.auth.signOut();
      window.location.reload();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
