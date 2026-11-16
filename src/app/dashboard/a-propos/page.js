export default function AProposPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8"> 
      <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"> 
        <div className="px-6 py-5 md:px-8 md:py-6 bg-gradient-to-r from-[#1a365d] via-[#234876] to-[#1a365d] text-white"> 
          <h1 className="text-xl md:text-2xl font-bold">A propos</h1>
          <p className="mt-2 text-sm md:text-base text-blue-50"> 
            GIRAS est une plateforme conçue pour structurer le pilotage des risques, des actions et des indicateurs stratégiques. 
          </p>
        </div>

        <div className="px-6 py-6 md:px-8 md:py-8 space-y-6 text-gray-700 leading-7"> 
          <section>
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-5"> 
              <p className="text-base md:text-lg font-semibold text-[#1a365d] mb-3">Objectifs de la plateforme</p>
              <ul className="space-y-3 text-sm md:text-base"> 
                <li>• Centraliser et optimiser la gestion des risques, de leur identification jusqu'au suivi rigoureux du plan de maîtrise.</li>
                <li>• Renforcer le suivi de la mise en œuvre des actions et diligences.</li>
                <li>• Centraliser le suivi des indicateurs stratégiques pour une vision consolidée de la performance.</li>
                <li>• Améliorer la traçabilité et l'auditabilité des actions.</li>
                <li>• Renforcer le suivi opérationnel et éclairer la prise de décision au plus haut niveau.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4"> 
            <p>
              Développée pour répondre aux exigences de pilotage, de coordination et de suivi opérationnel de la CNAM, la plateforme a été conçue par <span className="font-semibold">M. OUATTARA Ouanlo Fousseni</span>, joignable à l'adresse <a className="text-blue-700 hover:underline" href="mailto:fousseniouattara035@gmail.com">fousseniouattara035@gmail.com</a>.
            </p>
            <p>
              Sa conception s'inscrit sous les orientations stratégiques et éclairées du <span className="font-semibold">DGA de la CNAM, M. DIOMANDE Ahmed Tidiane</span>, avec les conseils de <span className="font-semibold">M. GNANDI Dalebe</span>, expert en actuariat.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
