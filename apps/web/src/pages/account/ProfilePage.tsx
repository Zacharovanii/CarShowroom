import { PasswordForm, ProfileForm } from "@/features/auth";
import styles from "./ProfilePage.module.css";

/** UC-U2. Контактные данные и смена пароля — раздел 7 макетов. */
export default function ProfilePage() {
  return (
    <div className={styles.stack}>
      <ProfileForm />
      <PasswordForm />
    </div>
  );
}
