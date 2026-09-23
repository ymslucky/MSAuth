import { LangSegmented, useT } from "../i18n";
import { ThemeToggle } from "../theme";
import { Link } from "../router";
import { docsConstraints, docsSections } from "../docsData";

/** Public integration guide — reachable without a session at /docs. */
export default function Docs() {
	const t = useT();
	return (
		<div className="docs-page">
			<header className="docs-bar">
				<Link to="/" className="brand"><img src="/favicon.svg" alt="" />MSAuth</Link>
				<span className="controls-row">
					<Link to="/" className="docs-console-link">{t("Open console")}</Link>
					<LangSegmented />
					<ThemeToggle />
				</span>
			</header>
			<main className="docs-wrap">
				<section className="docs-hero">
					<h1>{t("Integration guide")}</h1>
					<p>{t("Four ways to connect third parties to MSAuth — pick the one that matches your caller.")}</p>
				</section>
				{docsSections.map(section => (
					<section key={section.id} className="docs-card" aria-labelledby={`docs-${section.id}`}>
						<h2 id={`docs-${section.id}`}>{t(section.title)}</h2>
						<p className="docs-audience">{t(section.audience)}</p>
						<ol className="docs-steps">
							{section.steps.map(step => <li key={step}>{t(step)}</li>)}
						</ol>
						{section.code && (
							<div className="docs-code">
								<span className="docs-code-label">{t(section.code.label)}</span>
								<pre><code>{section.code.content}</code></pre>
							</div>
						)}
					</section>
				))}
				<section className="docs-card" aria-labelledby="docs-invariants">
					<h2 id="docs-invariants">{t("Platform invariants")}</h2>
					<dl className="docs-constraints">
						{docsConstraints.map(constraint => (
							<div key={constraint.rule} className="docs-constraint">
								<dt>{t(constraint.rule)}</dt>
								<dd>{t(constraint.detail)}</dd>
							</div>
						))}
					</dl>
				</section>
			</main>
		</div>
	);
}
