// src/pages/LandingPage.jsx

import { Link } from "react-router-dom";
import { CalendarDays, Users, Zap } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
          aria-hidden="true"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#80dfff] to-[#0077be] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
          ></div>
        </div>
        <div className="mx-auto max-w-2xl py-10 sm:py-16 lg:py-24">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Effortless Staff Scheduling
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Simplify your workforce management. Create, publish, and manage
              schedules with ease, so you can focus on what matters most.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                to="/login"
                className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="text-sm font-semibold leading-6 text-gray-900"
              >
                Sign Up <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Section */}
        <div className="mx-auto mt-16 max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl text-center">
              Everything you need to manage your team
            </p>
          </div>
          <div className="mx-auto py-16 max-w-2xl sm:py-20 lg:py-24 lg:max-w-4xl">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                    <CalendarDays className="h-6 w-6 text-white" />
                  </div>
                  Intuitive Schedule View
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  Visualize your entire week at a glance. Drag, drop, and edit
                  shifts in a clear, interactive calendar.
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  Worker Management
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  Easily add new team members, manage roles, and keep track of
                  important details like years of service.
                </dd>
              </div>
              <div className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  Publish Instantly
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-600">
                  Keep your team in the loop. Publish schedules with a single
                  click, making them instantly visible to your workers.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
