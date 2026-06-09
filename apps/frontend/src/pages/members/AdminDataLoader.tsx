import { useEffect } from "react";
import { apiUrl } from "../../lib/api";

export default function AdminDataLoader({ authToken, setAllUsers, setAllRoles }: { authToken: string; setAllUsers: any; setAllRoles: any }) {
  useEffect(() => {
    async function load() {
      const [uRes, rRes] = await Promise.all([
        fetch(apiUrl("/api/users"), { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch(apiUrl("/api/roles"), { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);
      const uData = await uRes.json();
      const rData = await rRes.json();
      if (uData.success) setAllUsers(uData.data || []);
      if (rData.success) setAllRoles(rData.data || []);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
