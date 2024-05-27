import { Fragment, useEffect, useState } from "react";

interface CountdownProps {
  targetDate: string; // YYYY-MM-DD format
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
}

function calculateTimeLeft(targetDate: string): TimeLeft {
  const target = new Date(`${targetDate}T00:00:00-08:00`);
  const now = new Date();
  const difference = +target - +now;

  if (difference <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
    };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
  };
}

const formatNumber = (number: number) => number.toString().padStart(2, "0");

const Countdown: React.FC<CountdownProps> = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(
    calculateTimeLeft(targetDate),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(targetDate);
      setTimeLeft(newTimeLeft);
      if (
        newTimeLeft.days === 0 &&
        newTimeLeft.hours === 0 &&
        newTimeLeft.minutes === 0
      ) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0
  ) {
    return null;
  }

  return (
    <div className="mb-4 countdown flex gap-1.5 justify-center">
      {["days", "hours", "minutes"].map((unit, index) => (
        <Fragment key={unit}>
          {index > 0 && <span className="h-[1.4em] grid place-content-center">:</span>}

          <div className={`${unit} grid grid-cols-2 gap-x-1 gap-y-1.5`}>
            <span className="h-[1.8em] w-[1.7em] grid place-content-center rounded-sm bg-gray-100 bg-opacity-10 dark:bg-gray-800 dark:bg-opacity-10 text-sm font-semibold">
              {formatNumber(timeLeft[unit as keyof TimeLeft]).charAt(0)}
            </span>
            <span className="h-[1.8em] w-[1.7em] grid place-content-center rounded-sm bg-gray-100 bg-opacity-10 dark:bg-gray-800 dark:bg-opacity-10 text-sm font-semibold">
              {formatNumber(timeLeft[unit as keyof TimeLeft]).charAt(1)}
            </span>
            <p className="col-span-full text-[.65rem]">{unit}</p>
          </div>
        </Fragment>
      ))}
    </div>
  );
};

export default Countdown;