export default function NewsPage() {
  return (
    <div>
      <section className="bg-[#F5EEE8] py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-4">📰</div>
          <h1 className="text-4xl font-black text-[#2D2D2D] mb-4" style={{ fontFamily: "'Fredoka One', cursive" }}>Actualités</h1>
          <p className="text-[#2D2D2D]/50 text-lg">Les dernières nouvelles de Monte & Souris</p>
        </div>
      </section>

      <section className="py-24 px-4 bg-[#FFFDF8]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-5xl mb-6">✨</div>
          <h2 className="text-2xl font-black text-[#2D2D2D] mb-4" style={{ fontFamily: "'Fredoka One', cursive" }}>
            Bientôt ici&nbsp;!
          </h2>
          <p className="text-[#2D2D2D]/55 leading-relaxed">
            Ateliers thématiques, conseils pour accompagner vos enfants, ressources pédagogiques… Revenez bientôt pour découvrir les actualités de Monte & Souris.
          </p>
        </div>
      </section>
    </div>
  );
}
