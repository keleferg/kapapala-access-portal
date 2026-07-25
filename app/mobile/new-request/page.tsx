import AuthGuard from "@/components/auth/AuthGuard"; import MobilePublicShell from "@/components/mobile/MobilePublicShell"; import DailyAccessRequestWizard from "@/components/access/DailyAccessRequestWizard";
export default function Page(){return <AuthGuard mode="user"><MobilePublicShell title="Request Access"><DailyAccessRequestWizard/></MobilePublicShell></AuthGuard>}
