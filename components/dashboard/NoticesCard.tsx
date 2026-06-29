import Card from "../ui/Card";

export default function NoticesCard() {
  return (
    <Card title="Current Notices">
      <ul className="notice-list">
        <li>No access restrictions are currently posted.</li>
        <li>Secure all gates immediately after passing through.</li>
        <li>Stay on designated access roads unless otherwise authorized.</li>
      </ul>
    </Card>
  );
}
