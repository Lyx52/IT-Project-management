<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MessageAttachmentTest extends TestCase
{
    use RefreshDatabase;

    private User $author;

    private User $visitor;

    private Post $post;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->author = User::factory()->create();
        $this->visitor = User::factory()->create();
        $this->post = Post::factory()->approved()->create(['user_id' => $this->author->id]);
    }

    private function url(): string
    {
        return "/api/v1/post/{$this->post->id}/messages";
    }

    private function mp4(int $kilobytes = 100): UploadedFile
    {
        // A real mp4 starts with an "ftyp" box, which is what content sniffing looks for
        $content = pack('N', 24).'ftypisom'.pack('N', 512).'isomiso2'.str_repeat("\0", $kilobytes * 1024);

        return UploadedFile::fake()->createWithContent('clip.mp4', $content);
    }

    public function test_sends_a_photo_with_no_text_and_stores_it_on_the_private_disk(): void
    {
        Sanctum::actingAs($this->visitor);

        $response = $this->post($this->url(), [
            'attachments' => [UploadedFile::fake()->image('keys.jpg', 200, 200)],
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.body', null)
            ->assertJsonPath('data.attachments.0.type', 'image')
            ->assertJsonPath('data.attachments.0.mime_type', 'image/jpeg');

        $attachment = MessageAttachment::firstOrFail();
        Storage::disk('local')->assertExists($attachment->path);
        $this->assertStringStartsWith('attachments/'.$attachment->message_id.'/', $attachment->path);
        $this->assertStringContainsString('signature=', $response->json('data.attachments.0.url'));
    }

    public function test_accepts_a_short_video(): void
    {
        Sanctum::actingAs($this->visitor);

        $this->post($this->url(), ['body' => 'Is this it?', 'attachments' => [$this->mp4()]], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.attachments.0.type', 'video');
    }

    public function test_rejects_other_file_types_and_oversized_files(): void
    {
        Sanctum::actingAs($this->visitor);
        $headers = ['Accept' => 'application/json'];

        $this->post($this->url(), ['attachments' => [UploadedFile::fake()->create('virus.pdf', 10, 'application/pdf')]], $headers)
            ->assertUnprocessable();
        // Renamed, but the content isn't an image
        $this->post($this->url(), ['attachments' => [UploadedFile::fake()->createWithContent('a.jpg', 'not an image')]], $headers)
            ->assertUnprocessable();
        $this->post($this->url(), ['attachments' => [UploadedFile::fake()->image('big.jpg')->size(6 * 1024)]], $headers)
            ->assertUnprocessable();
        $this->post($this->url(), ['attachments' => [$this->mp4(21 * 1024)]], $headers)
            ->assertUnprocessable();
        $this->post($this->url(), ['attachments' => array_fill(0, 4, UploadedFile::fake()->image('a.jpg'))], $headers)
            ->assertUnprocessable();

        $this->assertSame(0, Message::count());
        $this->assertSame(0, MessageAttachment::count());
    }

    public function test_a_message_needs_text_or_a_file(): void
    {
        Sanctum::actingAs($this->visitor);

        $this->postJson($this->url(), [])->assertUnprocessable();
    }

    public function test_the_link_works_with_its_signature_and_stops_working_when_it_expires(): void
    {
        Sanctum::actingAs($this->visitor);
        $url = $this->post($this->url(), [
            'attachments' => [UploadedFile::fake()->image('keys.png', 50, 50)],
        ], ['Accept' => 'application/json'])->json('data.attachments.0.url');

        // No token: the signature is what lets it in
        $this->app['auth']->forgetGuards();
        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/png');

        $this->travel(MessageAttachment::LINK_MINUTES + 1)->minutes();
        $this->get($url)->assertForbidden();
    }

    public function test_the_file_cannot_be_reached_without_a_valid_signature(): void
    {
        Sanctum::actingAs($this->visitor);
        $this->post($this->url(), [
            'attachments' => [UploadedFile::fake()->image('keys.jpg')],
        ], ['Accept' => 'application/json']);
        $attachment = MessageAttachment::firstOrFail();

        $this->get("/api/v1/message-attachments/{$attachment->id}")->assertForbidden();
        $this->get("/api/v1/message-attachments/{$attachment->id}?signature=forged")->assertForbidden();
    }

    public function test_only_the_two_people_in_the_conversation_get_links(): void
    {
        Sanctum::actingAs($this->visitor);
        $this->post($this->url(), [
            'attachments' => [UploadedFile::fake()->image('keys.jpg')],
        ], ['Accept' => 'application/json']);

        Sanctum::actingAs($this->author);
        $this->getJson($this->url().'?user_id='.$this->visitor->id)
            ->assertOk()
            ->assertJsonCount(1, 'data.0.attachments');

        // A third person has no conversation to read
        Sanctum::actingAs(User::factory()->create());
        $this->getJson($this->url())->assertOk()->assertJsonCount(0, 'data');
    }
}
