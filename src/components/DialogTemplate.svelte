<section class="mdc-elevation--z24 p-6 rounded">
	<h2 class="weight-medium mb-5 text-xl"><slot name="header" /></h2>
	<div class="slot-content">
		<slot name="content" />
	</div>
	<footer class="flex flex-wrap items-center justify-end pt-5">
		<slot name="footer" />
	</footer>
</section>
