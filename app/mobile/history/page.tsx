import AuthGuard from "@/components/auth/AuthGuard"; import MobilePublicShell from "@/components/mobile/MobilePublicShell"; import TripHistoryList from "@/components/access/TripHistoryList";
export default function Page(){return <AuthGuard mode="user"><MobilePublicShell title="Trip History"><TripHistoryList/></MobilePublicShell></AuthGuard>}
