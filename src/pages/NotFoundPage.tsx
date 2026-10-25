import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="page-panel panel not-found">
      <p className="eyebrow">404 · 走错寝室啦</p>
      <h1 tabIndex={-1}>这扇门后还没有房间</h1>
      <p className="page-lead">顺着走廊回去，小屋就在那边。</p>
      <Link to="/home" className="button button-primary">
        回到首页 →
      </Link>
    </section>
  );
}
