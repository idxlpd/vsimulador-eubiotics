import logo from '../assets/Logo_Blanco_crop.png';

interface EubioticsLogoProps {
  width?: number;
  className?: string;
}

const EubioticsLogo = ({ width = 180, className = '' }: EubioticsLogoProps) => {
  return (
    <img
      src={logo}
      width={width}
      alt="eubiotics"
      className={className}
      style={{ display: 'block' }}
    />
  );
};

export default EubioticsLogo;