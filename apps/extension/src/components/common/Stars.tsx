interface Props {
  rating: number;
}

function Stars({ rating }: Props) {
  return (
    <span className="stars" role="img" aria-label={`평점 ${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className={n <= rating ? 'star star--on' : 'star'} aria-hidden="true">
          <path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z" />
        </svg>
      ))}
    </span>
  );
}

export default Stars;
