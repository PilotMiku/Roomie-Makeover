import { Link } from 'react-router-dom';
import { MILESTONES } from '../data/constants';

export function RoadmapPage() {
  return (
    <section className="page-panel panel">
      <p className="eyebrow">ONE LITTLE STEP AT A TIME</p>
      <h1 tabIndex={-1}>入住计划</h1>
      <p className="page-lead">
        从入住到成长、换装、串门、收藏回忆与开启新周目，都可以在这间粉色小屋里完成。生产版本准备好后支持离线继续游玩。
      </p>
      <ol className="roadmap-list">
        {MILESTONES.map((milestone) => (
          <li
            key={milestone.id}
            className={
              milestone.id === 'M7' ? 'milestone current' : 'milestone'
            }
          >
            <span className="milestone-id">{milestone.id}</span>
            <div>
              <h2>{milestone.title}</h2>
              <p>{milestone.description}</p>
            </div>
            <span className="stage-badge">{milestone.state}</span>
          </li>
        ))}
      </ol>
      <Link className="text-link" to="/home">
        ← 回到小屋首页
      </Link>
    </section>
  );
}
