import { BookwormSprite } from "./bookworm-sprite"
import styles from "./guest-welcome-mascot.module.css"

export function GuestWelcomeMascot() {
  return (
    <div className={styles.stage}>
      <p className="sr-only">Welcome. Ready to get started?</p>

      <span aria-hidden="true" className={`${styles.bubble} ${styles.bubbleFirst}`}>
        Welcome!
      </span>
      <span aria-hidden="true" className={`${styles.bubble} ${styles.bubbleSecond}`}>
        Ready to get started?
      </span>

      <BookwormSprite
        animated
        bodyMotion={false}
        className={styles.mascot}
        label="Bookworm welcoming new readers"
        priority
        size="lg"
      />
    </div>
  )
}
