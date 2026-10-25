import { Link } from 'react-router-dom';
import { RoomIllustration } from '../components/RoomIllustration';
import { PROJECT_NAME } from '../data/constants';
import { useGame } from '../state/game';

export function HomePage() {
  const setup = useGame((state) => state.game.setup);
  return (
    <>
      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="tiny-star" aria-hidden="true">
              ✦
            </span>{' '}
            {PROJECT_NAME} · 大学室友的可爱日常
          </p>
          <h1 tabIndex={-1}>
            室友<span className="highlight">大改造</span>
            <span className="hero-subtitle">今天，也要可爱一点 ♡</span>
          </h1>
          <p className="hero-description">
            粉色小屋、蝴蝶结，还有风格各异的大学室友。
            <br className="desktop-break" />
            从选择身份开始，写下你的寝室男娘养成日记。把男娘进度培养到
            100，解锁蕾丝女仆装。
          </p>
          <Link className="button button-primary" to="/customize">
            {setup === 'done' ? '打开自定义工坊' : '定制我的入住故事'}{' '}
            <span aria-hidden="true">♡</span>
          </Link>
          <Link className="text-link home-play-link" to="/room">
            进入我的寝室 →
          </Link>
          <p className="quiet-note">
            自由选身份 · 定制 4 / 6 / 8 人寝 · 创建室友
          </p>
          <Link className="text-link roadmap-home-link" to="/roadmap">
            看看入住计划 →
          </Link>
        </div>
        <RoomIllustration />
      </section>
      <section className="intro-section" aria-labelledby="little-things">
        <div className="section-title">
          <div>
            <p className="eyebrow">LIFE IN LITTLE PIXELS</p>
            <h2 id="little-things">可爱，由你来定义 🎀</h2>
          </div>
          <span className="handwritten" aria-hidden="true">
            慢一点，也没关系。
          </span>
        </div>
        <div className="feature-grid">
          <article className="feature-card">
            <span className="feature-icon sage" aria-hidden="true">
              ▦
            </span>
            <p className="card-stage">已开放 ♡</p>
            <h3>布置你的寝室</h3>
            <p>4 / 6 / 8 人寝、上下铺与卫浴配置，打造喜欢的小空间。</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon peach" aria-hidden="true">
              ♡
            </span>
            <p className="card-stage">已开放 ♡</p>
            <h3>遇见不同的室友</h3>
            <p>自选身份，自定义室友的姓名、专业、标签与头像配色。</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon lavender" aria-hidden="true">
              ✧
            </span>
            <p className="card-stage">已开放 ♡</p>
            <h3>穿出今天的心情</h3>
            <p>32 件六槽服装、配色与收藏套装，表达由自己决定。</p>
            <Link className="text-link" to="/wardrobe">
              打开换装衣柜 →
            </Link>
          </article>
        </div>
      </section>
      <aside className="notice-strip">
        <span aria-hidden="true">✿</span>
        <p>
          从 <strong>大学寝室的日常</strong> 开始，自由表达、平等相处。
        </p>
        <Link to="/settings">
          了解与设置 <span aria-hidden="true">↗</span>
        </Link>
      </aside>
    </>
  );
}
