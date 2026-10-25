/** Original decorative DOM/CSS art. This is not an interactive game map. */
export function RoomIllustration() {
  return (
    <div
      className="room-art"
      role="img"
      aria-label="樱粉色寝室里有蝴蝶结、爱心靠枕、格纹床铺和花束，等待室友入住。"
    >
      <div className="art-wall" />
      <div className="art-bow" aria-hidden="true">
        🎀
      </div>
      <div className="art-heart-garland" aria-hidden="true">
        ♡ ─ ♡ ─ ♡ ─ ♡
      </div>
      <div className="art-window">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="art-sunbeam" />
      <div className="art-poster">
        LOVE
        <br />
        YOURSELF
      </div>
      <div className="art-shelf">
        <i />
        <i />
        <i />
      </div>
      <div className="art-bed">
        <div className="art-pillow" />
        <div className="art-blanket" />
      </div>
      <div className="art-rug" />
      <div className="art-desk">
        <div className="art-monitor" />
        <div className="art-book" />
      </div>
      <div className="art-chair" />
      <div className="art-plant">
        <i />
        <i />
        <i />
        <span />
      </div>
      <span className="art-spark art-spark-one">✦</span>
      <span className="art-spark art-spark-two">✦</span>
      <span className="art-caption">一间粉色小屋，收藏所有可爱日常 ♡</span>
    </div>
  );
}
