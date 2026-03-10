import { FacebookLogo, TwitterLogo, LinkedinLogo, InstagramLogo } from '@phosphor-icons/react';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-slate-900 text-slate-100 mt-16">
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    {/* About */}
                    <div>
                        <h3 className="font-bold text-lg mb-4 text-slate-50">RoomBook</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Your trusted platform for booking conference rooms and meeting spaces with ease.
                        </p>
                        <div className="flex gap-4 mt-6">
                            <a href="#" className="text-slate-400 hover:text-primary transition-colors">
                                <FacebookLogo size={20} weight="fill" />
                            </a>
                            <a href="#" className="text-slate-400 hover:text-primary transition-colors">
                                <TwitterLogo size={20} weight="fill" />
                            </a>
                            <a href="#" className="text-slate-400 hover:text-primary transition-colors">
                                <LinkedinLogo size={20} weight="fill" />
                            </a>
                            <a href="#" className="text-slate-400 hover:text-primary transition-colors">
                                <InstagramLogo size={20} weight="fill" />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-bold text-slate-50 mb-4">Quick Links</h4>
                        <ul className="space-y-3">
                            <li><a href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">Browse Rooms</a></li>
                            <li><a href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">My Bookings</a></li>
                            <li><a href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">Calendar</a></li>
                            <li><a href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">My Profile</a></li>
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h4 className="font-bold text-slate-50 mb-4">Support</h4>
                        <ul className="space-y-3">
                            <li><a href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">Help Center</a></li>
                            <li><a href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">Contact Us</a></li>
                            <li><a href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">FAQs</a></li>
                            <li><a href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">Documentation</a></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="font-bold text-slate-50 mb-4">Legal</h4>
                        <ul className="space-y-3">
                            <li><a href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">Privacy Policy</a></li>
                            <li><a href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">Terms of Service</a></li>
                            <li><a href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">Cookie Policy</a></li>
                            <li><a href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">Security</a></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-slate-800 pt-8">
                    <div className="flex flex-col md:flex-row justify-between items-center text-sm text-slate-400">
                        <p>&copy; {currentYear} RoomBook. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
