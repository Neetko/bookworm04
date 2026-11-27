import styles from "./guest-welcome-mascot.module.css"

export function GuestWelcomeMascot() {
  return <div className={styles.stage}>
    <p className={styles.visuallyHidden}>Welcome. Ready to get started?</p>
    <span aria-hidden="true" className={`${styles.bubble} ${styles.bubbleFirst}`}>Welcome!</span>
    <span aria-hidden="true" className={`${styles.bubble} ${styles.bubbleSecond}`}>Ready to get started?</span>
    <span className={styles.sprite} role="img" aria-label="Bookworm welcoming new readers">
      <span className={styles.shadow} aria-hidden="true" />
      <img className={styles.atlas} src="/mascot/idle-v6/atlas.webp" width="1280" height="480" alt="" aria-hidden="true" draggable={false} />
    </span>
  </div>
}
