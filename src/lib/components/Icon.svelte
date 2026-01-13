<script>
	import {
		Package,
		Upload,
		Shield,
		Lightbulb,
		Settings,
		Download,
		FolderOpen,
		Folder,
		FileText,
		AlertTriangle,
		X,
		Trash2,
		Lock,
		Sun,
		Moon,
		Edit,
		Eye,
		Key,
		HardDrive,
		Bold,
		Italic,
		Strikethrough,
		Code,
		List,
		ListOrdered,
		Quote,
		Link,
		Image,
		Table,
		AlignLeft,
		AlignCenter,
		AlignRight,
		Palette,
		Calendar,
		Type,
		Star,
		ArrowDown,
		ArrowUp,
		ArrowRight,
		Tag,
		ChevronRight,
		ChevronLeft,
		ChevronDown,
		Bell,
		Info,
		XCircle,
		AlertCircle,
		Clock,
		Briefcase,
		Home,
		Book,
		Heart,
		Music,
		Camera,
		Video,
		Gamepad2,
		ShoppingBag,
		GraduationCap,
		Stethoscope,
		Car,
		Plane,
		Utensils,
		Coffee,
		Zap,
		Target,
		Users,
		Mail,
		Phone,
		MapPin,
		Plus,
		LayoutGrid,
		Menu,
		CheckCircle,
		Check,
		Loader2,
		Search,
		MessageSquare,
		RefreshCw
	} from 'lucide-svelte';

	// Mapping delle icone più comuni che useremo nell'app
	const iconMap = {
		// Backup & Export/Import
		package: Package,
		upload: Upload,
		download: Download,
		folderOpen: FolderOpen,
		folder: Folder,
		fileText: FileText,

		// Sicurezza
		shield: Shield,
		lock: Lock,
		key: Key,

		// UI generale
		lightbulb: Lightbulb,
		settings: Settings,
		alertTriangle: AlertTriangle,
		x: X,
		trash: Trash2,
		sun: Sun,
		moon: Moon,
		edit: Edit,
		eye: Eye,
		hardDrive: HardDrive,
		search: Search,

		// Editor toolbar
		bold: Bold,
		italic: Italic,
		strikethrough: Strikethrough,
		code: Code,
		list: List,
		'list-ordered': ListOrdered,
		quote: Quote,
		link: Link,
		image: Image,
		table: Table,
		'align-left': AlignLeft,
		'align-center': AlignCenter,
		'align-right': AlignRight,
		palette: Palette,
		
		// Organization
		calendar: Calendar,
		text: Type,
		star: Star,
		'arrow-down': ArrowDown,
		'arrow-up': ArrowUp,
		'arrow-right': ArrowRight,
		tag: Tag,
		'chevron-right': ChevronRight,
		'chevron-left': ChevronLeft,
		'chevron-down': ChevronDown,
		plus: Plus,
		grid: LayoutGrid,
		menu: Menu,
		'check-circle': CheckCircle,
		check: Check,
		loader: Loader2,
		bell: Bell,
		info: Info,
		'x-circle': XCircle,
		'alert-circle': AlertCircle,
		clock: Clock,
		'message-square': MessageSquare,
		'refresh-cw': RefreshCw,
		
		// Folder icons
		briefcase: Briefcase,
		home: Home,
		book: Book,
		heart: Heart,
		music: Music,
		camera: Camera,
		video: Video,
		gamepad: Gamepad2,
		shopping: ShoppingBag,
		school: GraduationCap,
		health: Stethoscope,
		car: Car,
		travel: Plane,
		food: Utensils,
		coffee: Coffee,
		project: Zap,
		goals: Target,
		team: Users,
		mail: Mail,
		phone: Phone,
		location: MapPin
	};

	export let name = '';
	export let size = 16;
	export let className = '';
	export let strokeWidth = 2;

	$: iconComponent = iconMap[name];
</script>

{#if iconComponent}
	<svelte:component
		this={iconComponent}
		{size}
		class="icon {className}"
		strokeWidth={strokeWidth}
	/>
{:else}
	<span class="icon-missing" title="Icon '{name}' not found">?</span>
{/if}

<style>
	.icon {
		display: inline-block;
		flex-shrink: 0;
	}

	.icon-missing {
		display: inline-block;
		width: 1em;
		height: 1em;
		background: var(--error-color, #ef4444);
		color: white;
		border-radius: 50%;
		text-align: center;
		font-size: 0.8em;
		font-weight: bold;
		line-height: 1;
	}
</style>
