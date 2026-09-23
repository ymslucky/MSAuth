import { useState, type KeyboardEvent } from "react";
import { LangSegmented, useT } from "../i18n";
import { ThemeToggle } from "../theme";
import { Link } from "../router";
import { docsConstraints, docsSections } from "../docsData";
import { toMarkdown } from "../docsMarkdown";

/** Public integration guide — reachable without a session at /docs.
 *  Layout: sticky table of contents + scenario tabs, full-bleed width.
 *  "Markdown" mode exposes the raw, copyable Markdown source. */
export default function Docs() {
	const t = useT();
	const [activeId, setActiveId] = useState(docsSections[0].id);
	const [markdownMode, setMarkdownMode] = useState(false);
	const [copied, setCopied] = useState(false);
	const active = docsSections.find(section => section.id === activeId) ?? docsSections[0];

	function jumpTo(id: string, isSection: boolean) {
		if (isSection) setActiveId(id);
		document.getElementById(`docs-block-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	function onTabsKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
		const index = docsSections.findIndex(section => section.id === active.id);
		const delta = event.key === "ArrowRight" ? 1 : -1;
		const next = docsSections[(index + delta + docsSections.length) % docsSections.length];
		setActiveId(next.id);
		document.getElementById(`docs-tab-${next.id}`)?.focus();
		event.preventDefault();
	}

	async function copyMarkdown() {
		try {
			await navigator.clipboard.writeText(toMarkdown(docsSections, docsConstraints, t));
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			// clipboard unavailable (insecure context) — silently skip
		}
	}

	return (
		<div className="docs-page">
			<header className="docs-topbar">
				<Link to="/" className="brand"><img src="/favicon.svg" alt="" />MSAuth</Link>
				<span className="controls-row">
					<Link to="/" className="docs-console-link">{t("Open console")}</Link>
					<LangSegmented />
					<ThemeToggle />
				</span>
			</header>
			<div className="docs-body">
				<aside className="docs-toc" aria-label={t("On this page")}>
					<p className="docs-toc-title">{t("On this page")}</p>
					<nav className="docs-toc-nav">
						{docsSections.map(section => (
							<button
								key={section.id}
								type="button"
								className={section.id === active.id ? "active" : undefined}
								onClick={() => jumpTo(section.id, true)}
							>
								{t(section.title)}
							</button>
						))}
						<button type="button" onClick={() => jumpTo("invariants", false)}>{t("Platform invariants")}</button>
					</nav>
				</aside>
				<main className="docs-main">
					<section className="docs-hero">
						<div>
							<h1>{t("Integration guide")}</h1>
							<p>{t("Four ways to connect third parties to MSAuth — pick the one that matches your caller.")}</p>
						</div>
						<div className="docs-mode" role="group" aria-label={t("Documentation")}>
							<button type="button" aria-pressed={!markdownMode} onClick={() => setMarkdownMode(false)}>{t("Documentation")}</button>
							<button type="button" aria-pressed={markdownMode} onClick={() => setMarkdownMode(true)}>{t("Markdown")}</button>
						</div>
					</section>
					{markdownMode ? (
						<section className="docs-card docs-md" aria-label="Markdown">
							<div className="docs-md-bar">
								<span className="docs-code-label">Markdown</span>
								<button type="button" className="docs-copy" onClick={() => void copyMarkdown()}>
									{copied ? t("Copied") : t("Copy markdown")}
								</button>
							</div>
							<pre><code>{toMarkdown(docsSections, docsConstraints, t)}</code></pre>
						</section>
					) : (
						<>
							<div className="docs-tabs" role="tablist" aria-label={t("Integration guide")} onKeyDown={onTabsKeyDown}>
								{docsSections.map(section => (
									<button
										key={section.id}
										type="button"
										role="tab"
										id={`docs-tab-${section.id}`}
										aria-selected={section.id === active.id}
										aria-controls={`docs-block-${section.id}`}
										tabIndex={section.id === active.id ? 0 : -1}
										className={section.id === active.id ? "docs-tab active" : "docs-tab"}
										onClick={() => setActiveId(section.id)}
									>
										{t(section.title)}
									</button>
								))}
							</div>
							{docsSections.map(section => (
								<section
									key={section.id}
									id={`docs-block-${section.id}`}
									role="tabpanel"
									aria-labelledby={`docs-tab-${section.id}`}
									className="docs-card"
									hidden={section.id !== active.id}
								>
									<h2>{t(section.title)}</h2>
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
							<section id="docs-block-invariants" className="docs-card">
								<h2>{t("Platform invariants")}</h2>
								<dl className="docs-constraints">
									{docsConstraints.map(constraint => (
										<div key={constraint.rule} className="docs-constraint">
											<dt>{t(constraint.rule)}</dt>
											<dd>{t(constraint.detail)}</dd>
										</div>
									))}
								</dl>
							</section>
						</>
					)}
				</main>
			</div>
		</div>
	);
}
