import './Projects.css';
import { useEffect, useState } from 'react';
import { FiStar, FiCode } from 'react-icons/fi';

export default function Projects() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('https://api.github.com/users/Sharduljoshi2001/repos?sort=updated')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch repos');
        return res.json();
      })
      .then((data) => {
        setRepos(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <section className="projects" id="projects">
      <h1 className="projects__title">My GitHub Repositories</h1>
      <p className="projects__subtitle">A gallery of my latest open-source work. Click any card to view the repo on GitHub.</p>
      {loading && <div className="projects__loading">Loading...</div>}
      {error && <div className="projects__error">{error}</div>}
      <div className="projects__scroller">
        {repos.map((repo, i) => (
          <a
            key={repo.id}
            className="projects__repo projects__repo--fade"
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ animationDelay: `${i * 0.07 + 0.1}s` }}
          >
            <div className="projects__repo-name">{repo.name}</div>
            <div className="projects__repo-desc">{repo.description || 'No description'}</div>
            <div className="projects__repo-meta">
              <span className="projects__repo-stars"><FiStar /> {repo.stargazers_count}</span>
              {repo.language && (
                <span className="projects__repo-lang"><FiCode /> {repo.language}</span>
              )}
              <span className="projects__repo-updated">
                Updated {new Date(repo.updated_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
