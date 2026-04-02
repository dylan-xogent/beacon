import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/Card";

interface GuildCardProps {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
}

export function GuildCard({ id, name, icon, memberCount }: GuildCardProps) {
  return (
    <Link href={`/dashboard/${id}`} className="block group">
      <Card
        padding={false}
        className="p-4 hover:border-brand-500 hover:shadow-md transition-all duration-200 cursor-pointer"
      >
        <div className="flex items-center gap-4">
          {icon ? (
            <Image
              src={icon}
              alt={`${name} icon`}
              width={48}
              height={48}
              className="rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {memberCount.toLocaleString()} members
            </p>
          </div>
          <svg
            className="ml-auto h-5 w-5 text-gray-400 group-hover:text-brand-500 transition-colors flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </Card>
    </Link>
  );
}
